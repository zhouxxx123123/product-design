-- =============================================================================
-- RLS (Row Level Security) 策略配置
-- 在schema.sql执行后运行
-- =============================================================================

-- 1. 创建current_tenant_id函数
-- 从当前会话变量获取租户ID，用于RLS策略
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
  -- 从当前会话变量获取，使用true参数表示如果不存在返回空字符串而非报错
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION current_tenant_id() IS '获取当前请求上下文中的租户ID';

-- 2. 创建is_super_tenant函数
-- 检查当前用户是否为超级租户(中科琉光管理员)
CREATE OR REPLACE FUNCTION is_super_tenant()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_setting('app.is_super_tenant', true) = 'true';
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_super_tenant() IS '检查当前用户是否为超级租户';

-- 3. 创建启用租户RLS的辅助函数
-- 简化重复配置
CREATE OR REPLACE FUNCTION enable_tenant_rls(table_name TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('
    -- 启用RLS并强制对所有用户生效
    ALTER TABLE %I ENABLE ROW LEVEL SECURITY;
    ALTER TABLE %I FORCE ROW LEVEL SECURITY;

    -- 创建隔离策略: 用户只能看到/操作属于自己租户的数据
    -- 超级租户可以看到所有租户的数据
    CREATE POLICY tenant_isolation_policy ON %I
      FOR ALL
      TO application_user
      USING (
        tenant_id = current_tenant_id()
        OR is_super_tenant()
      )
      WITH CHECK (
        tenant_id = current_tenant_id()
        OR is_super_tenant()
      );
  ', table_name, table_name, table_name);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enable_tenant_rls(TEXT) IS '为指定表启用租户隔离的RLS策略';

-- 4. 为所有业务表启用RLS
-- 注意: 以下表都有tenant_id字段

-- 案例相关表
SELECT enable_tenant_rls('cases');
SELECT enable_tenant_rls('case_features');

-- 访谈相关表
SELECT enable_tenant_rls('interview_sessions');
SELECT enable_tenant_rls('client_profiles');
SELECT enable_tenant_rls('recordings');
SELECT enable_tenant_rls('transcriptions');
SELECT enable_tenant_rls('insights');
SELECT enable_tenant_rls('interview_departments');
SELECT enable_tenant_rls('interview_questions');

-- 配置表
SELECT enable_tenant_rls('templates');

-- AI记忆表
SELECT enable_tenant_rls('copilot_memories');

-- 转录片段表
SELECT enable_tenant_rls('transcript_segments');

-- 租户功能特性表 (tenant_features 主键为 (tenant_id, key)，直接使用 tenant_id 列)
ALTER TABLE tenant_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_features FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_features_isolation_policy ON tenant_features
  FOR ALL
  TO application_user
  USING (
    tenant_id = current_tenant_id()
    OR is_super_tenant()
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR is_super_tenant()
  );

-- 字典节点表
SELECT enable_tenant_rls('dictionary_nodes');

-- 会话评论表
SELECT enable_tenant_rls('session_comments');

-- 会话案例关联表
SELECT enable_tenant_rls('session_case_links');

-- 会话洞察表
SELECT enable_tenant_rls('session_insights');

-- 5. audit_logs表的特殊策略
-- 审计日志允许插入但限制查询
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- 插入策略: 任何用户只能插入自己租户的数据
CREATE POLICY audit_logs_insert_policy ON audit_logs
  FOR INSERT
  TO application_user
  WITH CHECK (tenant_id = current_tenant_id());

-- 查询策略: 只能查询自己租户的审计日志，超级租户可查看全部
CREATE POLICY audit_logs_select_policy ON audit_logs
  FOR SELECT
  TO application_user
  USING (
    tenant_id = current_tenant_id()
    OR is_super_tenant()
  );

-- 6. tenants表的特殊策略
-- 租户只能看到自己的租户数据
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_self_policy ON tenants
  FOR ALL
  TO application_user
  USING (
    id = current_tenant_id()
    OR is_super_tenant()
  )
  WITH CHECK (
    id = current_tenant_id()
    OR is_super_tenant()
  );

-- 7. users表的RLS策略 (通过tenant_id关联)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- 用户可以查看自己所属租户的其他用户
-- 以及公开的用户信息
CREATE POLICY users_tenant_policy ON users
  FOR ALL
  TO application_user
  USING (
    tenant_id = current_tenant_id()
    OR is_super_tenant()
    OR id = current_setting('app.current_user_id', true)::UUID
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR is_super_tenant()
  );

-- 8. tenant_members表的RLS策略
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_members_policy ON tenant_members
  FOR ALL
  TO application_user
  USING (
    tenant_id = current_tenant_id()
    OR is_super_tenant()
    OR user_id = current_setting('app.current_user_id', true)::UUID
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR is_super_tenant()
  );

-- 9. 验证RLS策略
-- 创建测试函数
CREATE OR REPLACE FUNCTION check_rls_status(table_name TEXT)
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
  WHERE c.relname = table_name
    AND n.nspname = 'public';
END;
$$ LANGUAGE plpgsql;

-- 10. 查看已启用的RLS策略
-- SELECT * FROM pg_policies WHERE schemaname = 'public';

-- 11. 性能优化: RLS策略与索引的配合说明
-- 为确保RLS策略高效执行，以下复合索引是必需的:
-- - (tenant_id, id) - 主键查询
-- - (tenant_id, created_at DESC) - 列表查询
-- - (tenant_id, status) - 状态过滤
-- 这些索引在schema.sql中已定义

COMMENT ON FUNCTION check_rls_status(TEXT) IS '检查指定表的RLS状态';
