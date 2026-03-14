import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTemplateIsDefault1710000002000 implements MigrationInterface {
  name = 'AddTemplateIsDefault1710000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "templates"
      ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN NOT NULL DEFAULT FALSE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "templates" DROP COLUMN IF EXISTS "is_default"
    `);
  }
}
