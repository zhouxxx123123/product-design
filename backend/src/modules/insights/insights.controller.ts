import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { InsightsService } from './insights.service';
import { CreateInsightDto, UpdateInsightDto } from './insights.dto';
import { SessionInsightEntity } from '../../entities/session-insight.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

/**
 * 会话洞察模块 — 操作 session_insights 表（SessionInsightEntity）
 *
 * 三层洞察模型：
 *   Layer 1 = 关键引用（原始转写引语，直接证据）
 *   Layer 2 = 主题归纳（AI 从多段引用提炼的主题）
 *   Layer 3 = 战略摘要（跨主题的高层洞察 + 情感分析）
 *
 * ⚠️  注意：项目中还有 InsightEntity（insights 表），用于未来的跨会话全局洞察库。
 *       当前 API 全部操作 session_insights 表，两者不互通。
 */
@ApiTags('Session Insights')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get('sessions/:id/insights')
  @ApiOperation({
    summary: '获取会话的全部洞察',
    description: '查询指定会话的三层洞察列表（session_insights 表），按 layer ASC 排序。',
  })
  @ApiParam({ name: 'id', description: '会话 ID（UUID）' })
  findBySession(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.insightsService.findBySession(id, req.user.tenantId);
  }

  @Post('sessions/:id/insights/extract')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AI 提取洞察（重新生成）',
    description: `
调用 AI 服务分析会话转写文本，自动生成三层洞察并写入 session_insights 表。

**副作用**：会先删除该会话已有的全部洞察再重新写入，防止重复。
需要该会话已有转写片段（transcript_segments），否则返回 400。

**安全要求**：必须传入 force=true 查询参数以确认此破坏性操作。
    `.trim(),
  })
  @ApiParam({ name: 'id', description: '会话 ID（UUID）' })
  @ApiQuery({
    name: 'force',
    required: true,
    schema: { type: 'string', enum: ['true'] },
    description: '必须传 "true" 以确认覆盖已有洞察（此操作会删除当前所有洞察并重新生成）',
  })
  @ApiResponse({ status: 400, description: '缺少 force=true 参数，或会话无转写记录' })
  async extractFromSession(
    @Param('id') id: string,
    @Query('force') force: string,
    @Req() req: RequestWithUser,
  ): Promise<SessionInsightEntity[]> {
    if (force !== 'true') {
      throw new BadRequestException('请传入 force=true 以确认覆盖已有洞察');
    }
    return this.insightsService.extractFromSession(id, req.user.tenantId, req.user.id);
  }

  @Post('sessions/:id/insights')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({
    summary: '手动创建洞察',
    description: 'layer 取值 1/2/3，content 结构因 layer 不同而异。写入 session_insights 表。',
  })
  @ApiParam({ name: 'id', description: '会话 ID（UUID）' })
  create(@Param('id') id: string, @Req() req: RequestWithUser, @Body() dto: CreateInsightDto) {
    return this.insightsService.create(id, req.user.tenantId, req.user.id, dto);
  }

  @Patch('insights/:id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true, skipMissingProperties: true }))
  @ApiOperation({
    summary: '更新洞察内容',
    description: '仅允许更新 content 字段。editedBy 自动记录当前用户。操作 session_insights 表。',
  })
  @ApiParam({ name: 'id', description: '洞察 ID（UUID）' })
  update(@Param('id') id: string, @Req() req: RequestWithUser, @Body() dto: UpdateInsightDto) {
    return this.insightsService.update(id, req.user.tenantId, req.user.id, dto);
  }

  @Delete('insights/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '删除洞察',
    description: '硬删除（session_insights 表无软删除列）。',
  })
  @ApiParam({ name: 'id', description: '洞察 ID（UUID）' })
  async delete(@Param('id') id: string, @Req() req: RequestWithUser): Promise<void> {
    await this.insightsService.delete(id, req.user.tenantId);
  }
}
