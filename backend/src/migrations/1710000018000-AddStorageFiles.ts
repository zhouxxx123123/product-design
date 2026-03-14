import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStorageFiles1710000018000 implements MigrationInterface {
  name = 'AddStorageFiles1710000018000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "storage_files" (
        "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id"    UUID         NOT NULL,
        "file_id"      UUID         NOT NULL,
        "filename"     VARCHAR(255) NOT NULL,
        "originalname" VARCHAR(500) NOT NULL,
        "mimetype"     VARCHAR(127) NOT NULL,
        "size"         BIGINT       NOT NULL,
        "url"          TEXT         NOT NULL,
        "uploader_id"  UUID,
        "expires_at"   TIMESTAMPTZ,
        "is_expired"   BOOLEAN      NOT NULL DEFAULT FALSE,
        "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMPTZ,
        CONSTRAINT "PK_storage_files_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_storage_files_file_id" UNIQUE ("file_id"),
        CONSTRAINT "FK_storage_files_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_storage_files_tenant_id" ON "storage_files" ("tenant_id")`,
    );
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_storage_files_expires_at"
        ON "storage_files" ("expires_at")
        WHERE expires_at IS NOT NULL
    `);
    await queryRunner.query(`ALTER TABLE storage_files ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY storage_files_tenant_isolation ON storage_files
        FOR ALL
        USING (tenant_id = current_tenant_id())
        WITH CHECK (tenant_id = current_tenant_id())
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS storage_files_tenant_isolation ON storage_files`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_storage_files_expires_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_storage_files_tenant_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "storage_files"`);
  }
}
