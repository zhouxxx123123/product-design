import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { DataSource } from 'typeorm';
import { Request } from 'express';

/**
 * 租户上下文拦截器
 * 在每个请求开始时设置PostgreSQL会话变量
 * 用于RLS策略执行
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private dataSource: DataSource) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { tenantId?: string; role?: string } }>();
    const tenantId = request.user?.tenantId;
    const isSuperTenant = request.user?.role === 'super_admin';

    if (tenantId) {
      // 设置PostgreSQL会话变量
      await this.dataSource.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [
        String(tenantId),
      ]);
      await this.dataSource.query(`SELECT set_config('app.is_super_tenant', $1, true)`, [
        String(isSuperTenant),
      ]);
    }

    return next.handle();
  }
}
