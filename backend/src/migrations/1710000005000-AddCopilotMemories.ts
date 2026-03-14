import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCopilotMemories1710000005000 implements MigrationInterface {
  name = 'AddCopilotMemories1710000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "memory_type_enum" AS ENUM (
          'preference', 'learning', 'conversation', 'setting'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "copilot_memories" (
        "id"         UUID               NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"    UUID               NOT NULL,
        "tenant_id"  UUID               NOT NULL,
        "content"    TEXT               NOT NULL,
        "type"       "memory_type_enum" NOT NULL DEFAULT 'conversation',
        "source"     VARCHAR(200),
        "created_at" TIMESTAMPTZ        NOT NULL DEFAULT now(),
        CONSTRAINT "PK_copilot_memories_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_copilot_memories_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_copilot_memories_tenant_id" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_copilot_memories_user_tenant"
        ON "copilot_memories" ("user_id", "tenant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_copilot_memories_type"
        ON "copilot_memories" ("type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_copilot_memories_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_copilot_memories_user_tenant"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "copilot_memories"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "memory_type_enum"`);
  }
}
