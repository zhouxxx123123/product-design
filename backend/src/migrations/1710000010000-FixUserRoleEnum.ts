import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aligns the PostgreSQL `user_role_enum` type with the TypeORM UserRole enum.
 *
 * Before: ('admin', 'consultant', 'viewer')
 * After:  ('admin', 'sales', 'expert')
 *
 * Strategy:
 *   1. Add the two new values to the existing enum.
 *   2. Update any rows that still hold the old values (consultant → sales, viewer → expert).
 *   3. Drop the old values via the rename-then-drop pattern (PostgreSQL does not support
 *      DROP VALUE directly; we rename the enum type and recreate it).
 *
 * down() reverses all steps.
 */
export class FixUserRoleEnum1710000010000 implements MigrationInterface {
  name = 'FixUserRoleEnum1710000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Recreate the enum type in one transaction using CASE in the USING clause
    // to map old values (consultant → sales, viewer → expert) without needing
    // ADD VALUE in a prior transaction (which would violate PG's same-txn rule).
    await queryRunner.query(`ALTER TYPE "user_role_enum" RENAME TO "user_role_enum_old"`);

    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM ('admin', 'sales', 'expert')
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "role" DROP DEFAULT
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "role" TYPE "user_role_enum"
        USING CASE "role"::text
          WHEN 'consultant' THEN 'sales'::"user_role_enum"
          WHEN 'viewer'     THEN 'expert'::"user_role_enum"
          ELSE                   "role"::text::"user_role_enum"
        END
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "role" SET DEFAULT 'sales'
    `);

    await queryRunner.query(`DROP TYPE "user_role_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Recreate the original enum type
    await queryRunner.query(`ALTER TYPE "user_role_enum" RENAME TO "user_role_enum_new"`);

    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM ('admin', 'consultant', 'viewer')
    `);

    // Step 2: Reverse data migration
    await queryRunner.query(`
      UPDATE "users"
      SET "role" = 'consultant'
      WHERE "role" = 'sales'
    `);
    await queryRunner.query(`
      UPDATE "users"
      SET "role" = 'viewer'
      WHERE "role" = 'expert'
    `);

    // Step 3: Change the column back to the old enum
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "role" DROP DEFAULT
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "role" TYPE "user_role_enum"
        USING "role"::text::"user_role_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "role" SET DEFAULT 'consultant'
    `);

    // Drop the new enum type
    await queryRunner.query(`DROP TYPE "user_role_enum_new"`);
  }
}
