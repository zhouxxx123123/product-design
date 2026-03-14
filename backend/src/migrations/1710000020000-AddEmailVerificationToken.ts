import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerificationToken1710000020000 implements MigrationInterface {
  name = 'AddEmailVerificationToken1710000020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "email_verification_token" VARCHAR(100) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "email_verification_token"
    `);
  }
}
