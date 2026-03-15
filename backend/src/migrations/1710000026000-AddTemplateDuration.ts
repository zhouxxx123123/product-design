import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTemplateDuration1710000026000 implements MigrationInterface {
  name = 'AddTemplateDuration1710000026000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "duration" INTEGER NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "templates" DROP COLUMN IF EXISTS "duration"`,
    );
  }
}