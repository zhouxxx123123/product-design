import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientSizeAndStatus1710000015000 implements MigrationInterface {
  name = 'AddClientSizeAndStatus1710000015000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE client_profiles
      ADD COLUMN IF NOT EXISTS size VARCHAR(50),
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'potential'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_client_profiles_tenant_status
      ON client_profiles(tenant_id, status)
      WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_client_profiles_tenant_status`);
    await queryRunner.query(
      `ALTER TABLE client_profiles DROP COLUMN IF EXISTS status, DROP COLUMN IF EXISTS size`,
    );
  }
}
