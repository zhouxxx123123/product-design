import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDictionaryNodes1710000003000 implements MigrationInterface {
  name = 'AddDictionaryNodes1710000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dictionary_nodes" (
        "id"          UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"   UUID         NOT NULL,
        "name"        VARCHAR(100) NOT NULL,
        "code"        VARCHAR(50),
        "parent_id"   UUID,
        "level"       INTEGER      NOT NULL DEFAULT 1,
        "description" TEXT,
        "sort_order"  INTEGER      NOT NULL DEFAULT 0,
        "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "deleted_at"  TIMESTAMPTZ,
        CONSTRAINT "PK_dictionary_nodes_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_dictionary_nodes_tenant_id" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dictionary_nodes_tenant_parent"
        ON "dictionary_nodes" ("tenant_id", "parent_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dictionary_nodes_deleted_at"
        ON "dictionary_nodes" ("deleted_at")
        WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dictionary_nodes_deleted_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dictionary_nodes_tenant_parent"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dictionary_nodes"`);
  }
}
