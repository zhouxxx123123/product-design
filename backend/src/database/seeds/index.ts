/**
 * Initial seed script — idempotent (safe to re-run).
 *
 * Usage:
 *   npm run db:seed
 *
 * NOTE: The current UserEntity has no password_hash column.
 * If auth credentials are needed, add a password_hash column to
 * the users table via a new migration and re-run this seed.
 *
 * Seeded data:
 *   Tenant: 中科琉光  (slug: zhongke-liuguang, super tenant)
 *   Users:
 *     admin@openclaw.io   role: ADMIN
 *     sales@openclaw.io   role: SALES
 *     expert@openclaw.io  role: EXPERT
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { TenantEntity } from '../../entities/tenant.entity';
import { UserEntity, UserRole } from '../../entities/user.entity';

// Load .env relative to the backend directory where the script runs
config({ path: ['.env', '.env.local'] });

async function seed(): Promise<void> {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER ?? 'openclaw',
    password: process.env.DB_PASSWORD ?? 'openclaw_dev_password',
    database: process.env.DB_NAME ?? 'openclaw_dev',
    entities: [TenantEntity, UserEntity],
    synchronize: false,
    logging: false,
  });

  await ds.initialize();
  console.log('Database connection established.');

  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);

  // --- Tenant ---
  let tenant = await tenantRepo.findOne({
    where: { slug: 'zhongke-liuguang' },
    withDeleted: false,
  });

  if (!tenant) {
    tenant = tenantRepo.create({
      name: '中科琉光',
      slug: 'zhongke-liuguang',
      aiConfig: {
        provider: 'moonshot',
        model: 'kimi-k2.5',
        temperature: 0.7,
      },
      settings: { isSuperTenant: true },
    });
    tenant = await tenantRepo.save(tenant);
    console.log(`Created tenant: ${tenant.name} (id: ${tenant.id})`);
  } else {
    console.log(`Tenant already exists: ${tenant.name} (id: ${tenant.id})`);
  }

  // --- Users ---
  const seedUsers: Array<{ email: string; displayName: string; role: UserRole }> = [
    { email: 'admin@openclaw.io', displayName: 'Admin User', role: UserRole.ADMIN },
    { email: 'sales@openclaw.io', displayName: 'Sales User', role: UserRole.SALES },
    { email: 'expert@openclaw.io', displayName: 'Expert User', role: UserRole.EXPERT },
  ];

  for (const seed of seedUsers) {
    const existing = await userRepo.findOne({
      where: { email: seed.email },
      withDeleted: false,
    });

    if (!existing) {
      const passwordHash = await bcrypt.hash('openclaw123', 10);
      const user = userRepo.create({
        email: seed.email,
        displayName: seed.displayName,
        role: seed.role,
        tenantId: tenant.id,
        password: passwordHash,
      });
      await userRepo.save(user);
      console.log(
        `Created user: ${seed.email} (role: ${seed.role}) — default password: openclaw123`,
      );
    } else {
      console.log(`User already exists: ${seed.email}`);
    }
  }

  await ds.destroy();
  console.log('Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
