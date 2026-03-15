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
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
  getSchemaPath,
} from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { CreateSessionDto, UpdateSessionDto } from './dto';
import { InterviewStatus } from '../../entities/interview-session.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { IsEnum } from 'class-validator';

interface RequestWithUser extends Request {
  user: JwtUser;
}

class UpdateStatusDto {
  @IsEnum(InterviewStatus)
  status: InterviewStatus;
}

@ApiTags('Sessions')
@ApiBearerAuth()
@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @ApiOperation({
    summary: '获取会话列表',
    description: '分页查询当前租户的调研会话，支持按状态、客户过滤',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String, description: '按标题搜索' })
  @ApiQuery({ name: 'status', required: false, enum: InterviewStatus, description: '按状态过滤' })
  @ApiQuery({
    name: 'clientId',
    required: false,
    type: String,
    description: '按客户 ID 过滤（UUID）',
  })
  @ApiResponse({
    status: 200,
    description: '分页会话列表',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
              title: { type: 'string', example: '用户调研访谈' },
              clientId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440001' },
              status: { type: 'string', enum: Object.values(InterviewStatus) },
              interviewDate: { type: 'string', example: '2026-03-15T14:30:00Z' },
              insightsCount: { type: 'number', example: 5 },
              commentsCount: { type: 'number', example: 3 },
            },
          },
        },
        total: { type: 'number', example: 42 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 20 },
        totalPages: { type: 'number', example: 3 },
      },
    },
  })
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: InterviewStatus,
    @Query('clientId') clientId?: string,
  ) {
    return this.sessionsService.findAll(req.user.tenantId, {
      page: page ? parseInt(page, 10) || 1 : undefined,
      limit: limit ? parseInt(limit, 10) || 20 : undefined,
      search,
      status,
      clientId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: '获取会话详情' })
  @ApiParam({ name: 'id', description: '会话 ID（UUID）' })
  @ApiResponse({ status: 200, description: '会话详情' })
  @ApiResponse({ status: 404, description: '会话不存在' })
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.sessionsService.findById(id, req.user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: '创建调研会话' })
  @ApiResponse({ status: 201, description: '创建成功的会话' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  create(@Req() req: RequestWithUser, @Body() dto: CreateSessionDto) {
    return this.sessionsService.create(req.user.tenantId, req.user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新会话信息' })
  @ApiParam({ name: 'id', description: '会话 ID（UUID）' })
  @ApiResponse({ status: 200, description: '更新后的会话' })
  @ApiResponse({ status: 404, description: '会话不存在' })
  update(@Param('id') id: string, @Req() req: RequestWithUser, @Body() dto: UpdateSessionDto) {
    return this.sessionsService.update(id, req.user.tenantId, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: '更新会话状态',
    description: `可选状态: ${Object.values(InterviewStatus).join(', ')}`,
  })
  @ApiParam({ name: 'id', description: '会话 ID（UUID）' })
  @ApiBody({
    schema: {
      properties: { status: { type: 'string', enum: Object.values(InterviewStatus) } },
      required: ['status'],
    },
  })
  @ApiResponse({ status: 200, description: '状态更新成功' })
  @ApiResponse({ status: 400, description: '非法状态值' })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  updateStatus(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() body: UpdateStatusDto,
  ) {
    return this.sessionsService.updateStatus(id, req.user.tenantId, body.status);
  }

  @Delete(':id')
  @ApiOperation({ summary: '软删除会话' })
  @ApiParam({ name: 'id', description: '会话 ID（UUID）' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '会话不存在' })
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.sessionsService.softDelete(id, req.user.tenantId);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: '添加会话评论' })
  @ApiParam({ name: 'id', description: '会话 ID（UUID）' })
  @ApiBody({
    schema: {
      properties: {
        content: { type: 'string', example: '这段洞察很重要' },
        targetType: { type: 'string', example: 'insight', description: '评论目标类型（可选）' },
        targetId: {
          type: 'string',
          example: '550e8400-e29b-41d4-a716-446655440000',
          description: '评论目标 ID（可选）',
        },
      },
      required: ['content'],
    },
  })
  @ApiResponse({ status: 201, description: '评论添加成功' })
  addComment(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() body: { content: string; targetType?: string; targetId?: string },
  ) {
    return this.sessionsService.addComment(
      id,
      req.user.id,
      req.user.tenantId,
      body.content,
      body.targetType,
      body.targetId,
    );
  }

  @Get(':id/comments')
  @ApiOperation({ summary: '获取会话评论列表' })
  @ApiParam({ name: 'id', description: '会话 ID（UUID）' })
  @ApiResponse({ status: 200, description: '评论列表' })
  getComments(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.sessionsService.getComments(id, req.user.tenantId);
  }

  @Post(':id/cases')
  @ApiOperation({ summary: '关联案例到会话', description: '将已有案例与本会话建立关联' })
  @ApiParam({ name: 'id', description: '会话 ID（UUID）' })
  @ApiBody({
    schema: {
      properties: {
        caseId: {
          type: 'string',
          example: '550e8400-e29b-41d4-a716-446655440000',
          description: '案例 ID（UUID）',
        },
        reason: { type: 'string', example: '客户有类似痛点', description: '关联原因（可选）' },
      },
      required: ['caseId'],
    },
  })
  @ApiResponse({ status: 201, description: '关联成功' })
  addCaseLink(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() body: { caseId: string; reason?: string },
  ) {
    return this.sessionsService.addCaseLink(
      id,
      body.caseId,
      req.user.tenantId,
      req.user.id,
      body.reason,
    );
  }

  @Get(':id/cases')
  @ApiOperation({ summary: '获取会话关联案例列表' })
  @ApiParam({ name: 'id', description: '会话 ID（UUID）' })
  @ApiResponse({ status: 200, description: '关联案例列表' })
  getCaseLinks(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.sessionsService.getCaseLinks(id, req.user.tenantId);
  }
}
