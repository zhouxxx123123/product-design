import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWechatFields1710000014000 implements MigrationInterface {
  name = 'AddWechatFields1710000014000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 添加微信登录字段
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "wechat_open_id" character varying(100)
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "wechat_union_id" character varying(100)
    `);

    // 添加唯一索引（仅对非空值）
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_wechat_open_id"
      ON "users" ("wechat_open_id")
      WHERE "wechat_open_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_wechat_open_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "wechat_union_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "wechat_open_id"`);
  }
}
