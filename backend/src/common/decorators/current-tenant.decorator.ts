import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @CurrentTenant() 参数装饰器
 *
 * 从请求上下文中提取当前用户所属的租户 ID。
 * 需在 JwtAuthGuard 之后使用，否则 request.user 为 undefined。
 *
 * 用法示例:
 * ```typescript
 * @Get()
 * @UseGuards(JwtAuthGuard)
 * findAll(@CurrentTenant() tenantId: string) {
 *   return this.service.findAll(tenantId);
 * }
 * ```
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ user?: { tenantId?: string } }>();
    return request.user?.tenantId ?? '';
  },
);
