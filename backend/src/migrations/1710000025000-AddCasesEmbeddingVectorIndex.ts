import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCasesEmbeddingVectorIndex1710000025000 implements MigrationInterface {
  name = 'AddCasesEmbeddingVectorIndex1710000025000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure pgvector extension is available
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // Convert embedding column from TEXT to vector(1536)
    // Use a safe approach: add new column, copy data, drop old, rename
    // But since the column is TEXT with vector-formatted strings, we can cast directly
    await queryRunner.query(`
      ALTER TABLE cases
      ALTER COLUMN embedding TYPE vector(1536)
      USING embedding::vector(1536)
    `);

    // Create IVFFlat index for approximate nearest neighbor search
    // lists=100 is appropriate for moderate data volumes (thousands of cases)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_embedding_ivfflat
      ON cases
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS idx_cases_embedding_ivfflat`);
    // Revert column back to TEXT
    await queryRunner.query(`
      ALTER TABLE cases
      ALTER COLUMN embedding TYPE TEXT
      USING embedding::text
    `);
  }
}
