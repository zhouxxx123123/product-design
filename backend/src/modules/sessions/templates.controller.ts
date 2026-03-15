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
} from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplateType } from '../../entities/template.entity';
import { DefaultSection } from './types/default-template.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@ApiTags('Templates')
@ApiBearerAuth()
@Controller('templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: '获取模板列表（分页）' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量' })
  @ApiQuery({ name: 'search', required: false, type: String, description: '搜索关键词' })
  @ApiQuery({
    name: 'templateType',
    required: false,
    enum: ['interview', 'questionnaire', 'outline', 'report'],
  })
  @ApiResponse({ status: 200, description: '模板列表' })
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('templateType') templateType?: TemplateType,
  ) {
    return this.templatesService.findAll(req.user.tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      templateType,
    });
  }

  @Get('categories')
  @ApiOperation({ summary: '获取模板分类列表（含数量统计）' })
  @ApiResponse({ status: 200, description: '分类列表' })
  @UseGuards(JwtAuthGuard)
  async getCategories(@Req() req: RequestWithUser): Promise<{ category: string; count: number }[]> {
    return this.templatesService.findCategories(req.user.tenantId);
  }

  @Get('default-structure')
  @ApiOperation({ summary: '获取默认模板结构（访谈提纲骨架）' })
  @ApiResponse({ status: 200, description: '默认模板结构' })
  @UseGuards(JwtAuthGuard)
  async getDefaultStructure(): Promise<{ sections: DefaultSection[] }> {
    return this.templatesService.getDefaultStructure();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取模板详情' })
  @ApiParam({ name: 'id', description: '模板 ID' })
  @ApiResponse({ status: 200, description: '模板详情' })
  @ApiResponse({ status: 404, description: '模板不存在' })
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.templatesService.findById(id, req.user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: '创建模板（需 ADMIN/EXPERT）' })
  @ApiResponse({ status: 201, description: '模板创建成功' })
  @ApiResponse({ status: 403, description: '需要 ADMIN/EXPERT 权限' })
  @Roles('ADMIN', 'EXPERT')
  create(@Req() req: RequestWithUser, @Body() dto: CreateTemplateDto) {
    return this.templatesService.create(req.user.tenantId, req.user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新模板（需 ADMIN/EXPERT）' })
  @ApiParam({ name: 'id', description: '模板 ID' })
  @ApiResponse({ status: 200, description: '模板更新成功' })
  @ApiResponse({ status: 403, description: '需要 ADMIN/EXPERT 权限' })
  @ApiResponse({ status: 404, description: '模板不存在' })
  @Roles('ADMIN', 'EXPERT')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  update(@Param('id') id: string, @Req() req: RequestWithUser, @Body() dto: UpdateTemplateDto) {
    return this.templatesService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '软删除模板（需 ADMIN/EXPERT）' })
  @ApiParam({ name: 'id', description: '模板 ID' })
  @ApiResponse({ status: 200, description: '模板删除成功' })
  @ApiResponse({ status: 403, description: '需要 ADMIN/EXPERT 权限' })
  @ApiResponse({ status: 404, description: '模板不存在' })
  @Roles('ADMIN', 'EXPERT')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.templatesService.softDelete(id, req.user.tenantId);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: '复制模板（需 ADMIN/EXPERT）' })
  @ApiParam({ name: 'id', description: '模板 ID' })
  @ApiResponse({ status: 201, description: '模板复制成功' })
  @ApiResponse({ status: 403, description: '需要 ADMIN/EXPERT 权限' })
  @ApiResponse({ status: 404, description: '模板不存在' })
  @Roles('ADMIN', 'EXPERT')
  duplicate(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.templatesService.duplicate(id, req.user.tenantId, req.user.id);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: '设为默认模板（需 ADMIN/EXPERT）' })
  @ApiParam({ name: 'id', description: '模板 ID' })
  @ApiResponse({ status: 200, description: '设置成功' })
  @ApiResponse({ status: 403, description: '需要 ADMIN/EXPERT 权限' })
  @ApiResponse({ status: 404, description: '模板不存在' })
  @Roles('ADMIN', 'EXPERT')
  setDefault(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.templatesService.setDefault(id, req.user.tenantId);
  }
}
