import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTemplateCategory1710000023000 implements MigrationInterface {
  name = 'AddTemplateCategory1710000023000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "category" VARCHAR(100) NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_templates_category" ON "templates" ("category")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_templates_category_created_at" ON "templates" ("category", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_templates_category_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_templates_category"`);
    await queryRunner.query(`ALTER TABLE "templates" DROP COLUMN IF EXISTS "category"`);
  }
}
