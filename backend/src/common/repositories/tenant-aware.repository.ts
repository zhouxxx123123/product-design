import { Injectable } from '@nestjs/common';
import { Repository, DataSource, FindManyOptions, FindOneOptions } from 'typeorm';

/**
 * 租户感知的基础Repository
 * 自动处理tenant_id过滤和RLS上下文
 *
 * 使用方法:
 * ```typescript
 * @Injectable()
 * class CaseRepository extends TenantAwareRepository<CaseEntity> {
 *   constructor(dataSource: DataSource) {
 *     super(dataSource, CaseEntity);
 *   }
 * }
 * ```
 */
@Injectable()
export abstract class TenantAwareRepository<T> extends Repository<T> {
  constructor(
    protected readonly dataSource: DataSource,
    entity: new () => T
  ) {
    super(entity, dataSource.createEntityManager());
  }

  /**
   * 设置当前租户上下文
   * 影响RLS策略执行
   */
  async setTenantContext(tenantId: string, isSuper: boolean = false): Promise<void> {
    await this.dataSource.query(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`
    );
    await this.dataSource.query(
      `SET LOCAL app.is_super_tenant = '${isSuper}'`
    );
  }

  /**
   * 在租户上下文中执行查询
   * 自动设置和清理RLS上下文
   */
  async withTenant<R>(
    tenantId: string,
    operation: () => Promise<R>,
    isSuper: boolean = false
  ): Promise<R> {
    await this.setTenantContext(tenantId, isSuper);
    try {
      return await operation();
    } finally {
      // 清理上下文
      await this.dataSource.query('SET LOCAL app.current_tenant_id = NULL');
      await this.dataSource.query('SET LOCAL app.is_super_tenant = false');
    }
  }

  /**
   * 在指定租户上下文中查询
   */
  async findInTenant(
    tenantId: string,
    options?: FindManyOptions<T>
  ): Promise<T[]> {
    return this.withTenant(tenantId, () => this.find(options));
  }

  /**
   * 在指定租户上下文中查询单个
   */
  async findOneInTenant(
    tenantId: string,
    options?: FindOneOptions<T>
  ): Promise<T | null> {
    return this.withTenant(tenantId, () => this.findOne(options));
  }

  /**
   * 安全创建 - 自动设置tenant_id
   */
  async createInTenant(
    tenantId: string,
    entityData: Partial<T>
  ): Promise<T> {
    const entity = this.create({
      ...entityData,
      tenantId,
    } as DeepPartial<T>);
    return this.save(entity);
  }
}

/**
 * DeepPartial类型辅助
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
