import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 启用行级安全策略 (Row Level Security)
 *
 * 为所有业务表启用 RLS，确保租户数据隔离。
 * 依赖 rls-policies.sql 中定义的辅助函数：
 *   - current_tenant_id()
 *   - is_super_tenant()
 *   - enable_tenant_rls(table_name)
 *
 * 此 migration 是幂等的（可重复执行），使用 IF NOT EXISTS 和 OR REPLACE。
 */
export class EnableRLS1710000009000 implements MigrationInterface {
  name = 'EnableRLS1710000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // -------------------------------------------------------------------------
    // 1. 创建/更新辅助函数
    // -------------------------------------------------------------------------

    // current_tenant_id(): 从 PostgreSQL 会话变量获取当前租户 ID
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION current_tenant_id()
      RETURNS UUID AS $$
      BEGIN
        RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
      EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    // is_super_tenant(): 检查当前用户是否为超级管理员
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION is_super_tenant()
      RETURNS BOOLEAN AS $$
      BEGIN
        RETURN current_setting('app.is_super_tenant', true) = 'true';
      EXCEPTION WHEN OTHERS THEN
        RETURN FALSE;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    // enable_tenant_rls(table_name): 为指定表启用租户隔离 RLS 策略
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enable_tenant_rls(p_table_name TEXT)
      RETURNS VOID AS $$
      DECLARE
        v_policy_name TEXT;
      BEGIN
        v_policy_name := p_table_name || '_tenant_isolation_policy';

        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

        -- 删除已存在的同名策略（幂等）
        EXECUTE format(
          'DROP POLICY IF EXISTS %I ON %I',
          v_policy_name, p_table_name
        );

        EXECUTE format('
          CREATE POLICY %I ON %I
            FOR ALL
            USING (
              tenant_id = current_tenant_id()
              OR is_super_tenant()
            )
            WITH CHECK (
              tenant_id = current_tenant_id()
              OR is_super_tenant()
            )
        ', v_policy_name, p_table_name);
      END;
      $$ LANGUAGE plpgsql;
    `);

    // check_rls_status(table_name): 验证 RLS 配置状态
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION check_rls_status(p_table_name TEXT)
      RETURNS TABLE (
        relname TEXT,
        relrowsecurity BOOLEAN,
        relforcerowsecurity BOOLEAN
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT
          c.relname::TEXT,
          c.relrowsecurity,
          c.relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = p_table_name
          AND n.nspname = 'public';
      END;
      $$ LANGUAGE plpgsql;
    `);

    // -------------------------------------------------------------------------
    // Helper: apply RLS only if the table exists (safe for tables created in
    // later migrations or not yet implemented in this phase).
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enable_tenant_rls_if_exists(p_table_name TEXT)
      RETURNS VOID AS $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = p_table_name
        ) THEN
          PERFORM enable_tenant_rls(p_table_name);
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // -------------------------------------------------------------------------
    // 2. 案例相关表
    // -------------------------------------------------------------------------
    await queryRunner.query(`SELECT enable_tenant_rls_if_exists('cases')`);
    await queryRunner.query(`SELECT enable_tenant_rls_if_exists('case_features')`);

    // -------------------------------------------------------------------------
    // 3. 访谈相关表
    // -------------------------------------------------------------------------
    await queryRunner.query(`SELECT enable_tenant_rls_if_exists('interview_sessions')`);
    await queryRunner.query(`SELECT enable_tenant_rls_if_exists('client_profiles')`);
    await queryRunner.query(`SELECT enable_tenant_rls_if_exists('insights')`);
    await queryRunner.query(`SELECT enable_tenant_rls_if_exists('transcript_segments')`);

    // -------------------------------------------------------------------------
    // 4. 协作表
    // -------------------------------------------------------------------------
    await queryRunner.query(`SELECT enable_tenant_rls_if_exists('session_comments')`);
    await queryRunner.query(`SELECT enable_tenant_rls_if_exists('session_case_links')`);
    await queryRunner.query(`SELECT enable_tenant_rls_if_exists('session_insights')`);

    // -------------------------------------------------------------------------
    // 5. 配置相关表
    // -------------------------------------------------------------------------
    await queryRunner.query(`SELECT enable_tenant_rls_if_exists('templates')`);
    await queryRunner.query(`SELECT enable_tenant_rls_if_exists('dictionary_nodes')`);
    await queryRunner.query(`SELECT enable_tenant_rls_if_exists('copilot_memories')`);

    // -------------------------------------------------------------------------
    // 6. tenant_features 表 (主键为复合键，单独处理)
    // -------------------------------------------------------------------------
    await queryRunner.query(`ALTER TABLE tenant_features ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE tenant_features FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(
      `DROP POLICY IF EXISTS tenant_features_isolation_policy ON tenant_features`,
    );
    await queryRunner.query(`
      CREATE POLICY tenant_features_isolation_policy ON tenant_features
        FOR ALL
        USING (
          tenant_id = current_tenant_id()
          OR is_super_tenant()
        )
        WITH CHECK (
          tenant_id = current_tenant_id()
          OR is_super_tenant()
        )
    `);

    // -------------------------------------------------------------------------
    // 7. audit_logs 表 (特殊策略: 分离 INSERT 和 SELECT) — skip if not yet created
    // -------------------------------------------------------------------------
    const auditLogsExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'audit_logs'
      ) AS "exists"
    `);
    if (auditLogsExists[0]?.exists) {
      await queryRunner.query(`ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`DROP POLICY IF EXISTS audit_logs_insert_policy ON audit_logs`);
      await queryRunner.query(`DROP POLICY IF EXISTS audit_logs_select_policy ON audit_logs`);
      await queryRunner.query(`
        CREATE POLICY audit_logs_insert_policy ON audit_logs
          FOR INSERT
          WITH CHECK (tenant_id = current_tenant_id())
      `);
      await queryRunner.query(`
        CREATE POLICY audit_logs_select_policy ON audit_logs
          FOR SELECT
          USING (
            tenant_id = current_tenant_id()
            OR is_super_tenant()
          )
      `);
    }

    // -------------------------------------------------------------------------
    // 8. tenants 表 (仅能访问自己的租户记录)
    // -------------------------------------------------------------------------
    await queryRunner.query(`ALTER TABLE tenants ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE tenants FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_self_policy ON tenants`);
    await queryRunner.query(`
      CREATE POLICY tenant_self_policy ON tenants
        FOR ALL
        USING (
          id = current_tenant_id()
          OR is_super_tenant()
        )
        WITH CHECK (
          id = current_tenant_id()
          OR is_super_tenant()
        )
    `);

    // -------------------------------------------------------------------------
    // 9. users 表 (通过 tenant_id 隔离，用户可见自己)
    // -------------------------------------------------------------------------
    await queryRunner.query(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE users FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS users_tenant_policy ON users`);
    await queryRunner.query(`
      CREATE POLICY users_tenant_policy ON users
        FOR ALL
        USING (
          tenant_id = current_tenant_id()
          OR is_super_tenant()
          OR id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
        )
        WITH CHECK (
          tenant_id = current_tenant_id()
          OR is_super_tenant()
        )
    `);

    // -------------------------------------------------------------------------
    // 10. tenant_members 表 — skip if not yet created
    // -------------------------------------------------------------------------
    const tenantMembersExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'tenant_members'
      ) AS "exists"
    `);
    if (tenantMembersExists[0]?.exists) {
      await queryRunner.query(`ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE tenant_members FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_members_policy ON tenant_members`);
      await queryRunner.query(`
        CREATE POLICY tenant_members_policy ON tenant_members
          FOR ALL
          USING (
            tenant_id = current_tenant_id()
            OR is_super_tenant()
            OR user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
          )
          WITH CHECK (
            tenant_id = current_tenant_id()
            OR is_super_tenant()
          )
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 按启用顺序的逆序禁用 RLS
    const tablesToDisable = [
      'tenant_members',
      'users',
      'tenants',
      'audit_logs',
      'tenant_features',
      'copilot_memories',
      'dictionary_nodes',
      'templates',
      'session_insights',
      'session_case_links',
      'session_comments',
      'transcript_segments',
      'insights',
      'client_profiles',
      'interview_sessions',
      'case_features',
      'cases',
    ];

    for (const table of tablesToDisable) {
      await queryRunner.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
    }

    // 删除辅助函数
    await queryRunner.query(`DROP FUNCTION IF EXISTS enable_tenant_rls(TEXT)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS check_rls_status(TEXT)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS is_super_tenant()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS current_tenant_id()`);
  }
}
