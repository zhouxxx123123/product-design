import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTemplateIdToInterviewSession1710000027000 implements MigrationInterface {
  name = 'AddTemplateIdToInterviewSession1710000027000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "interview_sessions" ADD COLUMN IF NOT EXISTS "template_id" UUID NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_interview_sessions_template_id" ON "interview_sessions" ("template_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_interview_sessions_template_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interview_sessions" DROP COLUMN IF EXISTS "template_id"`,
    );
  }
}
