import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { TenantMemberEntity } from '../../entities/tenant-member.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { TenantResponseDto } from './dto/tenant-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @ApiOperation({
    summary: '获取租户列表',
    description: '分页查询所有租户，支持按名称搜索（需 ADMIN 角色）',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String, example: '中科' })
  @ApiResponse({
    status: 200,
    description: '分页租户列表',
    schema: {
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/TenantResponseDto' } },
        total: { type: 'number', example: 5 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 20 },
        totalPages: { type: 'number', example: 1 },
      },
    },
  })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.tenantsService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    });
  }

  @Post()
  @ApiOperation({ summary: '创建租户', description: '创建新租户（需 ADMIN 角色）' })
  @ApiResponse({ status: 201, type: TenantResponseDto, description: '创建成功的租户' })
  @ApiResponse({ status: 409, description: 'slug 已被占用' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取租户详情' })
  @ApiParam({ name: 'id', description: '租户 ID（UUID）' })
  @ApiResponse({ status: 200, type: TenantResponseDto })
  @ApiResponse({ status: 404, description: '租户不存在' })
  findById(@Param('id') id: string) {
    return this.tenantsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新租户信息' })
  @ApiParam({ name: 'id', description: '租户 ID（UUID）' })
  @ApiResponse({ status: 200, type: TenantResponseDto })
  @ApiResponse({ status: 404, description: '租户不存在' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '软删除租户', description: '标记租户为已删除（软删除，不可恢复）' })
  @ApiParam({ name: 'id', description: '租户 ID（UUID）' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '租户不存在' })
  softDelete(@Param('id') id: string) {
    return this.tenantsService.softDelete(id);
  }

  // ── Members ──────────────────────────────────────────────────────────────────

  @Get(':id/members')
  @ApiOperation({ summary: '获取租户成员列表' })
  @ApiParam({ name: 'id', description: '租户 ID（UUID）' })
  @ApiResponse({ status: 200, description: '成员列表' })
  getMembers(@Param('id') id: string) {
    return this.tenantsService.getMembers(id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: '添加租户成员' })
  @ApiParam({ name: 'id', description: '租户 ID（UUID）' })
  @ApiResponse({ status: 201, description: '成员添加成功' })
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.tenantsService.addMember(id, dto);
  }

  @Delete(':id/members/:uid')
  @ApiOperation({ summary: '移除租户成员' })
  @ApiParam({ name: 'id', description: '租户 ID（UUID）' })
  @ApiParam({ name: 'uid', description: '用户 ID（UUID）' })
  @ApiResponse({ status: 200, description: '成员移除成功' })
  removeMember(@Param('id') id: string, @Param('uid') uid: string) {
    return this.tenantsService.removeMember(id, uid);
  }

  @Patch(':id/members/:uid/role')
  @ApiOperation({
    summary: '更新租户成员角色',
    description: '修改指定成员在租户中的角色权限（仅管理员可操作）',
  })
  @ApiParam({ name: 'id', description: '租户 ID（UUID）' })
  @ApiParam({ name: 'uid', description: '用户 ID（UUID）' })
  @ApiBody({ type: UpdateMemberRoleDto, description: '新角色信息' })
  @ApiResponse({
    status: 200,
    description: '角色更新成功',
    schema: {
      properties: {
        id: { type: 'string', example: 'uuid-12345' },
        tenantId: { type: 'string', example: 'uuid-67890' },
        userId: { type: 'string', example: 'uuid-abcde' },
        role: { type: 'string', enum: ['owner', 'admin', 'member', 'viewer'], example: 'admin' },
        joinedAt: { type: 'string', example: '2024-01-01T00:00:00Z' },
      },
    },
  })
  @ApiResponse({ status: 404, description: '成员不存在' })
  @ApiResponse({ status: 403, description: '权限不足' })
  updateMemberRole(
    @Param('id') id: string,
    @Param('uid') uid: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<TenantMemberEntity> {
    return this.tenantsService.updateMemberRole(id, uid, dto.role);
  }
}
