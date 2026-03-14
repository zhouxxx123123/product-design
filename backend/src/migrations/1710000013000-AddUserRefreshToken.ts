import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds refresh_token column to users table.
 */
export class AddUserRefreshToken1710000013000 implements MigrationInterface {
  name = 'AddUserRefreshToken1710000013000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "refresh_token" TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "refresh_token"
    `);
  }
}
