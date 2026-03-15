import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeatureDefinitions1710000022000 implements MigrationInterface {
  name = 'CreateFeatureDefinitions1710000022000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the enum type first
    await queryRunner.query(`
      CREATE TYPE "public"."feature_definitions_category_enum" AS ENUM('sales', 'expert', 'ai', 'system')
    `);

    // Create the table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feature_definitions" (
        "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
        "key"         VARCHAR(100) NOT NULL,
        "name"        VARCHAR(200) NOT NULL,
        "description" TEXT         NULL,
        "category"    "public"."feature_definitions_category_enum" NOT NULL,
        "icon_name"   VARCHAR(100) NOT NULL,
        "sort_order"  INTEGER      NOT NULL DEFAULT 0,
        "is_active"   BOOLEAN      NOT NULL DEFAULT TRUE,
        "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_feature_definitions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_feature_definitions_key" UNIQUE ("key")
      )
    `);

    // Create indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_feature_definitions_category" ON "feature_definitions" ("category")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_feature_definitions_active_sort" ON "feature_definitions" ("is_active", "sort_order")`,
    );

    // Insert default data
    await queryRunner.query(`
      INSERT INTO "feature_definitions" ("key", "name", "description", "category", "icon_name", "sort_order") VALUES
      ('crm', 'CRM客户管理', '客户关系管理系统，包含客户档案、跟进记录等功能', 'sales', 'Users', 1),
      ('survey_sessions', '调研任务管理', '管理调研任务的创建、执行、跟踪等全生命周期', 'sales', 'ClipboardList', 2),
      ('survey_templates', '调研模板库', '预设的调研问卷和访谈模板，可复用和定制', 'sales', 'FileText', 3),
      ('survey_workspace', '调研工作台', '实时录音、转录、笔记等调研执行工具', 'sales', 'Mic', 4),
      ('customer_portrait', '客户画像', '基于调研数据生成的客户特征分析和画像', 'sales', 'PieChart', 5),
      ('survey_insights', '调研洞察分析', 'AI驱动的调研数据分析和洞察发现', 'ai', 'BarChart3', 6),
      ('copilot', 'AI副驾驶助手', '智能对话助手，提供调研建议和分析支持', 'ai', 'Brain', 7),
      ('expert_workbench', '专家工作台', '专家知识管理和经验沉淀的综合平台', 'expert', 'Wrench', 8),
      ('case_library', '案例知识库', '行业案例、最佳实践的知识库管理', 'expert', 'BookOpen', 9),
      ('memory_management', '专家记忆管理', '专家个人知识和经验的存储与检索系统', 'expert', 'Database', 10)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_feature_definitions_active_sort"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_feature_definitions_category"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feature_definitions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."feature_definitions_category_enum"`);
  }
}
