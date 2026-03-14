import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionRecordingFileId1710000024000 implements MigrationInterface {
  name = 'AddSessionRecordingFileId1710000024000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "interview_sessions"
      ADD COLUMN "recording_file_id" uuid NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "interview_sessions"
      DROP COLUMN "recording_file_id"
    `);
  }
}