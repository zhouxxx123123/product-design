/**
 * Initial seed — idempotent (safe to re-run).
 *
 * Usage:
 *   npx ts-node src/seeds/initial.seed.ts
 *
 * Creates:
 *   Tenant : 中科琉光  (slug: zhongke-liuguang, isSuperTenant: true)
 *   Users  :
 *     admin@openclaw.io      role: ADMIN   name: 系统管理员  pw: password123
 *     sales@openclaw.io      role: SALES   name: 张销售      pw: password123
 *     expert@openclaw.io     role: EXPERT  name: 李专家      pw: password123
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { TenantEntity } from '../entities/tenant.entity';
import { UserEntity, UserRole } from '../entities/user.entity';

config({ path: ['.env', '.env.local'] });

const BCRYPT_ROUNDS = 10;

interface SeedUser {
  email: string;
  displayName: string;
  role: UserRole;
  plainPassword: string;
}

async function seed(): Promise<void> {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5433),
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
  let tenant = await tenantRepo.findOne({ where: { slug: 'zhongke-liuguang' } });

  if (!tenant) {
    tenant = tenantRepo.create({
      name: '中科琉光',
      slug: 'zhongke-liuguang',
      aiConfig: { provider: 'moonshot', model: 'kimi-k2.5', temperature: 0.7 },
      settings: { isSuperTenant: true },
    });
    tenant = await tenantRepo.save(tenant);
    console.log(`  [+] Tenant created: ${tenant.name} (id: ${tenant.id})`);
  } else {
    console.log(`  [=] Tenant exists : ${tenant.name} (id: ${tenant.id})`);
  }

  // --- Users ---
  const seedUsers: SeedUser[] = [
    {
      email: 'admin@openclaw.io',
      displayName: '系统管理员',
      role: UserRole.ADMIN,
      plainPassword: 'password123',
    },
    {
      email: 'sales@openclaw.io',
      displayName: '张销售',
      role: UserRole.SALES,
      plainPassword: 'password123',
    },
    {
      email: 'expert@openclaw.io',
      displayName: '李专家',
      role: UserRole.EXPERT,
      plainPassword: 'password123',
    },
  ];

  for (const seedUser of seedUsers) {
    const existing = await userRepo.findOne({ where: { email: seedUser.email } });

    if (!existing) {
      const passwordHash = await bcrypt.hash(seedUser.plainPassword, BCRYPT_ROUNDS);
      const user = userRepo.create({
        email: seedUser.email,
        displayName: seedUser.displayName,
        role: seedUser.role,
        password: passwordHash,
        tenantId: tenant.id,
        isActive: true,
      });
      await userRepo.save(user);
      console.log(`  [+] User created : ${seedUser.email} (role: ${seedUser.role})`);
    } else {
      console.log(`  [=] User exists  : ${seedUser.email}`);
    }
  }

  await ds.destroy();
  console.log('Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
