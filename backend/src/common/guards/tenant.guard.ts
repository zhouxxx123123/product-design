import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';

/**
 * 租户守卫
 * 验证用户是否有权访问指定租户的资源
 * 同时设置RLS所需的会话变量
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private dataSource: DataSource
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantId = request.params.tenantId || request.body.tenantId;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Super admin可以访问任何租户
    if (user.role === 'super_admin') {
      await this.setTenantContext(tenantId || user.tenantId, true);
      return true;
    }

    // 检查用户是否有权访问该租户
    if (tenantId && tenantId !== user.tenantId) {
      const hasAccess = await this.checkTenantMembership(user.id, tenantId);
      if (!hasAccess) {
        throw new ForbiddenException('No access to this tenant');
      }
    }

    await this.setTenantContext(user.tenantId, false);
    return true;
  }

  /**
   * 设置PostgreSQL会话变量
   */
  private async setTenantContext(
    tenantId: string,
    isSuper: boolean
  ): Promise<void> {
    await this.dataSource.query(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`
    );
    await this.dataSource.query(
      `SET LOCAL app.is_super_tenant = '${isSuper}'`
    );
  }

  /**
   * 检查用户是否是租户成员
   */
  private async checkTenantMembership(
    userId: string,
    tenantId: string
  ): Promise<boolean> {
    const result = await this.dataSource.query(
      `SELECT 1 FROM tenant_members WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId]
    );
    return result.length > 0;
  }
}
