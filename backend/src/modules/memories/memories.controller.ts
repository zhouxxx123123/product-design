import {
  Controller,
  Get,
  Delete,
  Query,
  Param,
  Req,
  UseGuards,
  Res,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { MemoriesService, MemoryListQuery } from './memories.service';
import { MemoryType } from '../../entities/copilot-memory.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@ApiTags('Memories (Copilot)')
@ApiBearerAuth()
@Controller('memories')
@UseGuards(JwtAuthGuard)
export class MemoriesController {
  constructor(private readonly memoriesService: MemoriesService) {}

  @Get()
  @ApiOperation({ summary: '获取 Copilot 记忆列表（分页）' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量' })
  @ApiQuery({ name: 'search', required: false, type: String, description: '搜索关键词' })
  @ApiQuery({
    name: 'type',
    required: false,
    description: '记忆类型 enum: client_preference/pain_point/background/custom',
  })
  @ApiResponse({ status: 200, description: '记忆列表' })
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: MemoryType,
  ) {
    const query: MemoryListQuery = {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      type,
    };
    return this.memoriesService.findAll(req.user.id, req.user.tenantId, query);
  }

  @Get('export')
  @ApiOperation({ summary: '导出全部记忆为 JSON 文件' })
  @ApiResponse({ status: 200, description: '返回 memories.json 附件' })
  async export(@Req() req: RequestWithUser, @Res() res: Response) {
    const data = await this.memoriesService.exportAll(req.user.id, req.user.tenantId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="memories.json"');
    res.send(JSON.stringify(data, null, 2));
  }

  @Delete()
  @ApiOperation({ summary: '清空当前用户全部记忆' })
  @ApiQuery({ name: 'confirm', required: true, description: '必须传 "true" 以确认清空全部记忆' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 400, description: '缺少 confirm=true 参数' })
  deleteAll(@Req() req: RequestWithUser, @Query('confirm') confirm?: string) {
    if (confirm !== 'true') {
      throw new BadRequestException('请传入 confirm=true 以确认清空全部记忆');
    }
    return this.memoriesService.deleteAll(req.user.id, req.user.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除单条记忆' })
  @ApiParam({ name: 'id', description: '记忆 ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '记忆不存在' })
  deleteOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.memoriesService.deleteOne(id, req.user.id, req.user.tenantId);
  }
}
