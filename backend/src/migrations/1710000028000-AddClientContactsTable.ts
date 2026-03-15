import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientContactsTable1710000028000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the client_contacts table
    await queryRunner.query(`
      CREATE TABLE client_contacts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100),
        phone VARCHAR(50),
        position VARCHAR(100),
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Add index for performance
    await queryRunner.query(
      `CREATE INDEX idx_client_contacts_client_id ON client_contacts(client_id)`,
    );

    // Migrate existing contact data from client_profiles to client_contacts
    await queryRunner.query(`
      INSERT INTO client_contacts (client_id, name, email, phone, position, sort_order)
      SELECT id, name, email, phone, position, 0
      FROM client_profiles
      WHERE name IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS client_contacts`);
  }
}
