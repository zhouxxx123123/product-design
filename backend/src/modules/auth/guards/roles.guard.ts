import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * RolesGuard - 基于角色的访问控制守卫
 *
 * 与 @Roles() 装饰器配合使用，验证当前用户是否具有所需角色。
 * 若路由未标注 @Roles()，则对所有已认证用户开放。
 *
 * 需在 JwtAuthGuard 之后注册（JwtAuthGuard 负责填充 request.user）。
 *
 * 用法:
 * ```typescript
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('ADMIN')
 * @Delete(':id')
 * remove() { ... }
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 没有 @Roles() 装饰器，允许所有已认证用户访问
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: { role?: string } }>();
    const userRole = request.user?.role;

    if (!userRole || !requiredRoles.some((r) => r.toLowerCase() === userRole.toLowerCase())) {
      throw new ForbiddenException(`此操作需要以下角色之一: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
