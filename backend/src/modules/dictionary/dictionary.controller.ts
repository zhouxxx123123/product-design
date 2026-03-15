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
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';
import { DictionaryService } from './dictionary.service';
import { CreateDictionaryNodeDto, UpdateDictionaryNodeDto } from './dto/dictionary.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@ApiTags('Dictionary')
@ApiBearerAuth()
@Controller('dictionary')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DictionaryController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  @Get()
  @ApiOperation({ summary: '获取字典节点树' })
  @ApiQuery({ name: 'parentId', required: false, description: '父节点 ID，为空时返回根节点' })
  @ApiResponse({ status: 200, description: '返回字典节点树结构' })
  findAll(@Req() req: RequestWithUser, @Query('parentId') parentId?: string) {
    return this.dictionaryService.findAll(req.user.tenantId, parentId);
  }

  @Post()
  @Roles('ADMIN', 'EXPERT')
  @ApiOperation({ summary: '创建字典节点（需 ADMIN/EXPERT）' })
  @ApiResponse({ status: 201, description: '字典节点创建成功' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 400, description: '请求参数无效' })
  create(@Req() req: RequestWithUser, @Body() dto: CreateDictionaryNodeDto) {
    return this.dictionaryService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'EXPERT')
  @ApiOperation({ summary: '更新字典节点（需 ADMIN/EXPERT）' })
  @ApiParam({ name: 'id', description: '字典节点ID' })
  @ApiResponse({ status: 200, description: '字典节点更新成功' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '字典节点不存在' })
  update(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateDictionaryNodeDto,
  ) {
    return this.dictionaryService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'EXPERT')
  @ApiOperation({ summary: '软删除字典节点（需 ADMIN/EXPERT）' })
  @ApiParam({ name: 'id', description: '字典节点ID' })
  @ApiResponse({ status: 200, description: '字典节点删除成功' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '字典节点不存在' })
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.dictionaryService.softDelete(id, req.user.tenantId);
  }
}
