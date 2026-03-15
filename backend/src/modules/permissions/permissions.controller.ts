import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PermissionsService, PermissionsWithCategories } from './permissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @ApiOperation({
    summary: '获取所有权限',
    description: '返回系统中的所有权限，按分类组织（仅管理员可访问）',
  })
  @ApiResponse({
    status: 200,
    description: '权限列表和分类信息',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: {
            properties: {
              id: { type: 'string', example: 'uuid-12345' },
              code: { type: 'string', example: 'users.read' },
              name: { type: 'string', example: '查看用户' },
              description: { type: 'string', example: '查看用户列表和详细信息' },
              category: { type: 'string', example: 'users' },
              createdAt: { type: 'string', example: '2024-01-01T00:00:00Z' },
            },
          },
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          example: ['users', 'clients', 'sessions', 'templates', 'cases', 'admin'],
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: '权限不足' })
  findAll(): Promise<PermissionsWithCategories> {
    return this.permissionsService.findAll();
  }

  @Get('by-role/:role')
  @ApiOperation({
    summary: '根据角色获取权限',
    description: '返回指定角色拥有的权限代码列表（仅管理员可访问）',
  })
  @ApiParam({ name: 'role', description: '角色名称', example: 'admin' })
  @ApiResponse({
    status: 200,
    description: '该角色的权限代码列表',
    schema: {
      type: 'array',
      items: { type: 'string' },
      example: ['users.read', 'users.create', 'users.update', 'users.delete'],
    },
  })
  @ApiResponse({ status: 403, description: '权限不足' })
  findByRole(@Param('role') role: string): Promise<string[]> {
    return this.permissionsService.findByRole(role);
  }
}
