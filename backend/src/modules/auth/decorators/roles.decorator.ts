import { SetMetadata } from '@nestjs/common';

/**
 * 角色常量，与 JWT payload 中 role 字段一致
 */
export const ROLES_KEY = 'roles';

/**
 * @Roles() 装饰器
 *
 * 标记路由所需的角色，配合 RolesGuard 使用。
 * 不添加此装饰器的路由对所有已认证用户开放。
 *
 * 用法示例:
 * ```typescript
 * @Post()
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('ADMIN', 'EXPERT')
 * create(@Body() dto: CreateUserDto) { ... }
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
