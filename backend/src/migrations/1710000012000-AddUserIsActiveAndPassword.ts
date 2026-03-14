import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds is_active and password columns to users table.
 * Both were defined in UserEntity but missing from the initial migrations.
 */
export class AddUserIsActiveAndPassword1710000012000 implements MigrationInterface {
  name = 'AddUserIsActiveAndPassword1710000012000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "password"  VARCHAR(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "is_active",
        DROP COLUMN IF EXISTS "password"
    `);
  }
}
