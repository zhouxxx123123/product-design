import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 补全缺失索引（索引审计补丁）
 *
 * 背景：RLS 策略在每次行访问时都会评估 tenant_id 条件。
 * 若相关列缺少索引，每次 RLS 检查都会触发全表扫描，
 * 在多租户高并发场景下造成严重性能问题。
 *
 * 分级：
 *   Critical  — RLS 相关 tenant_id 索引，必须补齐
 *   Medium    — 高频查询路径效率提升
 *   Low       — 删除冗余索引（被 Medium 级复合索引覆盖）
 *
 * 注意：TypeORM migration 默认在事务内执行，
 * 因此不能使用 CREATE INDEX CONCURRENTLY（事务内不允许）。
 * 所有索引均使用 IF NOT EXISTS 保证幂等性。
 */
export class AddMissingIndexes1710000011000 implements MigrationInterface {
  name = 'AddMissingIndexes1710000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // -------------------------------------------------------------------------
    // 0. pg_trgm 扩展（用于客户名模糊搜索）
    //    若数据库超级用户权限不足，此语句会被安全跳过。
    // -------------------------------------------------------------------------
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

    // =========================================================================
    // Critical: RLS tenant_id 索引
    // 防止 RLS 策略在每次行访问时触发全表扫描
    // =========================================================================

    // users 表：按租户 + 角色过滤（权限管理、用户列表）
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_tenant_role"
        ON "users" ("tenant_id", "role")
        WHERE deleted_at IS NULL
    `);

    // users 表：按租户 + 邮箱查找（登录、用户唯一性校验）
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_tenant_email"
        ON "users" ("tenant_id", "email")
        WHERE deleted_at IS NULL
    `);

    // client_profiles 表：RLS tenant_id 过滤
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_client_profiles_tenant_id"
        ON "client_profiles" ("tenant_id")
        WHERE deleted_at IS NULL
    `);

    // session_comments 表：RLS tenant_id 过滤（无 deleted_at 软删除）
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_comments_tenant_id"
        ON "session_comments" ("tenant_id")
    `);

    // session_comments 表：按作者查询评论
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_comments_author_id"
        ON "session_comments" ("author_id")
    `);

    // session_case_links 表：通过 case_id 反向关联访谈
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_case_links_case_id"
        ON "session_case_links" ("case_id")
    `);

    // session_case_links 表：RLS tenant_id 过滤
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_case_links_tenant_id"
        ON "session_case_links" ("tenant_id")
    `);

    // session_insights 表：RLS tenant_id 过滤
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_insights_tenant_id"
        ON "session_insights" ("tenant_id")
    `);

    // transcript_segments 表：RLS tenant_id 过滤
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transcript_segments_tenant_id"
        ON "transcript_segments" ("tenant_id")
    `);

    // =========================================================================
    // Medium: 高频查询路径效率提升
    // =========================================================================

    // copilot_memories 表：按租户 + 类型查询，按时间倒序（AI Copilot 检索）
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_copilot_memories_tenant_type_created"
        ON "copilot_memories" ("tenant_id", "type", "created_at" DESC)
    `);

    // templates 表：快速定位租户默认模板（访谈初始化路径）
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_templates_tenant_default"
        ON "templates" ("tenant_id", "template_type")
        WHERE is_default = TRUE AND deleted_at IS NULL
    `);

    // cases 表：按创建人查询（"我创建的案例"列表）
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cases_created_by"
        ON "cases" ("created_by")
        WHERE created_by IS NOT NULL
    `);

    // templates 表：按创建人查询（"我创建的模板"列表）
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_templates_created_by"
        ON "templates" ("created_by")
        WHERE created_by IS NOT NULL
    `);

    // dictionary_nodes 表：按租户 + 层级过滤（字典树展示）
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dictionary_nodes_tenant_level"
        ON "dictionary_nodes" ("tenant_id", "level")
        WHERE deleted_at IS NULL
    `);

    // =========================================================================
    // Medium: client_profiles 名称 trigram 索引（模糊搜索加速）
    // 依赖上方 pg_trgm 扩展；若扩展不可用此语句会报错，
    // 可在 down() 中安全回滚。
    // =========================================================================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_client_profiles_name_trgm"
        ON "client_profiles" USING GIN ("name" gin_trgm_ops)
    `);

    // =========================================================================
    // Low: 删除冗余索引
    // "IDX_session_case_links_session_id" 已被 session_id 上更宽的查询路径覆盖，
    // 或可由新增的复合索引替代，保留只会增加写放大。
    // =========================================================================
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_session_case_links_session_id"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // -------------------------------------------------------------------------
    // 逆序回滚：先恢复被删除的冗余索引，再删除新增的索引
    // -------------------------------------------------------------------------

    // 恢复被删除的冗余索引
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_case_links_session_id"
        ON "session_case_links" ("session_id")
    `);

    // 删除 Low 级之外的新增索引（逆序）
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_client_profiles_name_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dictionary_nodes_tenant_level"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_templates_created_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cases_created_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_templates_tenant_default"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_copilot_memories_tenant_type_created"`);

    // 删除 Critical 级索引（逆序）
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transcript_segments_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_session_insights_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_session_case_links_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_session_case_links_case_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_session_comments_author_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_session_comments_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_client_profiles_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_tenant_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_tenant_role"`);

    // pg_trgm 扩展不在 down() 中删除——其他表/索引可能依赖它，
    // 强制删除扩展可能破坏生产环境。若确实需要移除，请手动执行：
    //   DROP EXTENSION IF EXISTS "pg_trgm" CASCADE;
  }
}
