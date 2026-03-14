import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerified1710000017000 implements MigrationInterface {
  name = 'AddEmailVerified1710000017000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" boolean NOT NULL DEFAULT false`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verified"`);
  }
}
