/**
 * Demo seed script — idempotent (safe to re-run).
 *
 * Usage:
 *   npm run seed
 *
 * Creates:
 *   - 1 tenant:   OpenClaw Demo (slug: openclaw-demo)
 *   - 3 users:    admin / sales / expert @ openclaw.io
 *   - 2 clients:  GlobalTech Inc. / Nexus Solutions
 *   - 2 templates: 竞品调研访谈 / 用户需求挖掘
 *   - 1 session:  GlobalTech 金融科技需求访谈 (scheduled, 3 days from now)
 *
 * RLS:  Sets app.current_tenant_id session variable before all writes.
 *
 * Resilience:
 *   - tenant_members inserts are skipped when the table doesn't exist yet
 *     (the table is created by a migration that may not have been run).
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { DataSource, DefaultNamingStrategy, NamingStrategyInterface, QueryRunner } from 'typeorm';

import { TenantEntity } from './entities/tenant.entity';
import { UserEntity, UserRole } from './entities/user.entity';
import { ClientProfileEntity } from './entities/client-profile.entity';
import { TemplateEntity, TemplateType, TemplateScope } from './entities/template.entity';
import { InterviewSessionEntity, InterviewStatus } from './entities/interview-session.entity';

/**
 * Minimal snake_case naming strategy.
 * Required because some entity columns (e.g. templateType) lack explicit
 * `name:` in their @Column decorator, but the DB schema uses snake_case.
 */
class SnakeCaseNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  override columnName(
    propertyName: string,
    customName: string | undefined,
    _embeddedPrefixes: string[],
  ): string {
    // If the entity already provides an explicit name, respect it
    if (customName) return customName;
    // Otherwise convert camelCase → snake_case
    return propertyName.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Load environment — backend/.env overrides root ../.env (matching app.module)
// ---------------------------------------------------------------------------
config({ path: ['../.env', '.env', '.env.local'] });

// ---------------------------------------------------------------------------
// 2. DataSource — mirrors data-source.ts defaults exactly
// ---------------------------------------------------------------------------
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'openclaw',
  password: process.env.DB_PASSWORD ?? 'openclaw_dev_password',
  database: process.env.DB_NAME ?? 'openclaw_dev',
  entities: [TenantEntity, UserEntity, ClientProfileEntity, TemplateEntity, InterviewSessionEntity],
  namingStrategy: new SnakeCaseNamingStrategy(),
  synchronize: false,
  logging: false,
});

// ---------------------------------------------------------------------------
// 3. Helpers
// ---------------------------------------------------------------------------

/** Set RLS session variable so row-level security policies allow writes. */
async function setTenantContext(queryRunner: QueryRunner, tenantId: string): Promise<void> {
  await queryRunner.query(`SET app.current_tenant_id = '${tenantId}'`);
}

/** Returns true when the table exists in the public schema. */
async function tableExists(queryRunner: QueryRunner, tableName: string): Promise<boolean> {
  const rows = await queryRunner.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  return (rows as unknown[]).length > 0;
}

// ---------------------------------------------------------------------------
// 4. Seed
// ---------------------------------------------------------------------------
async function seed(): Promise<void> {
  await AppDataSource.initialize();
  console.log('✅ Database connection established.\n');

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const tenantRepo = queryRunner.manager.getRepository(TenantEntity);
    const userRepo = queryRunner.manager.getRepository(UserEntity);
    const clientRepo = queryRunner.manager.getRepository(ClientProfileEntity);
    const templateRepo = queryRunner.manager.getRepository(TemplateEntity);
    const sessionRepo = queryRunner.manager.getRepository(InterviewSessionEntity);

    // -----------------------------------------------------------------------
    // 4.1  Tenant
    // -----------------------------------------------------------------------
    let tenant = await tenantRepo.findOne({ where: { slug: 'openclaw-demo' } });

    if (!tenant) {
      const newTenant = tenantRepo.create({
        name: 'OpenClaw Demo',
        slug: 'openclaw-demo',
        aiConfig: {
          provider: 'moonshot',
          model: 'kimi-k2.5',
          temperature: 0.7,
        },
        settings: {},
      });
      tenant = await tenantRepo.save(newTenant);
      console.log(`✅ Created tenant: ${tenant.name}  (id: ${tenant.id})`);
    } else {
      console.log(`⏭️  Tenant already exists: ${tenant.name}  (id: ${tenant.id})`);
    }

    // Set RLS context for all subsequent writes
    await setTenantContext(queryRunner, tenant.id);

    // -----------------------------------------------------------------------
    // 4.2  Users
    // -----------------------------------------------------------------------
    const BCRYPT_ROUNDS = 10;

    interface UserSeed {
      email: string;
      password: string;
      displayName: string;
      role: UserRole;
    }

    const userSeeds: UserSeed[] = [
      {
        email: 'admin@openclaw.io',
        password: 'Admin@123456',
        displayName: '系统管理员',
        role: UserRole.ADMIN,
      },
      {
        email: 'sales@openclaw.io',
        password: 'Sales@123456',
        displayName: '销售顾问李华',
        role: UserRole.SALES,
      },
      {
        email: 'expert@openclaw.io',
        password: 'Expert@123456',
        displayName: '行业专家张伟',
        role: UserRole.EXPERT,
      },
    ];

    const createdUsers: Record<string, UserEntity> = {};

    for (const seedUser of userSeeds) {
      let user = await userRepo.findOne({ where: { email: seedUser.email } });

      if (!user) {
        const hash = await bcrypt.hash(seedUser.password, BCRYPT_ROUNDS);
        const newUser = userRepo.create({
          email: seedUser.email,
          displayName: seedUser.displayName,
          role: seedUser.role,
          tenantId: tenant.id,
          password: hash,
          isActive: true,
        });
        user = await userRepo.save(newUser);
        console.log(`✅ Created user: ${user.email}  (role: ${user.role})`);
      } else {
        console.log(`⏭️  User already exists: ${user.email}`);
      }

      createdUsers[seedUser.email] = user;
    }

    // -----------------------------------------------------------------------
    // 4.2b  tenant_members (best-effort — table may not exist yet)
    // -----------------------------------------------------------------------
    const hasMembersTable = await tableExists(queryRunner, 'tenant_members');

    if (hasMembersTable) {
      for (const seedUser of userSeeds) {
        const user = createdUsers[seedUser.email];
        if (!user) continue;

        const existing = await queryRunner.query(
          `SELECT id FROM tenant_members WHERE tenant_id = $1 AND user_id = $2`,
          [tenant.id, user.id],
        );

        if ((existing as unknown[]).length === 0) {
          const memberRole = seedUser.role === UserRole.ADMIN ? 'admin' : 'member';
          await queryRunner.query(
            `INSERT INTO tenant_members (id, tenant_id, user_id, role)
             VALUES (gen_random_uuid(), $1, $2, $3)`,
            [tenant.id, user.id, memberRole],
          );
          console.log(`   ↳ Added ${user.email} to tenant_members as ${memberRole}`);
        }
      }
    } else {
      console.log('⚠️  tenant_members table not found — skipping membership rows.');
      console.log('   Run pending migrations (npm run migration:run) to create it.');
    }

    const expertUser = createdUsers['expert@openclaw.io'];

    // -----------------------------------------------------------------------
    // 4.3  Client profiles
    // -----------------------------------------------------------------------
    interface ClientSeed {
      name: string;
      email: string;
      company: string;
      industry: string;
    }

    const clientSeeds: ClientSeed[] = [
      {
        name: '张伟',
        email: 'zhang.wei@globaltech.io',
        company: 'GlobalTech Inc.',
        industry: '金融科技',
      },
      {
        name: '李华',
        email: 'li.hua@nexus.io',
        company: 'Nexus Solutions',
        industry: '人工智能',
      },
    ];

    const createdClients: ClientProfileEntity[] = [];

    for (const seedClient of clientSeeds) {
      // Idempotency: match by tenantId + email (email is nullable but unique per tenant in practice)
      const existing = await clientRepo.findOne({
        where: { tenantId: tenant.id, email: seedClient.email },
      });

      if (!existing) {
        const client = clientRepo.create({
          tenantId: tenant.id,
          name: seedClient.name,
          email: seedClient.email,
          company: seedClient.company,
          industry: seedClient.industry,
          tags: null,
          notes: null,
        });
        const saved = await clientRepo.save(client);
        createdClients.push(saved);
        console.log(
          `✅ Created client: ${seedClient.name} @ ${seedClient.company}  (id: ${saved.id})`,
        );
      } else {
        createdClients.push(existing);
        console.log(`⏭️  Client already exists: ${seedClient.name} @ ${seedClient.company}`);
      }
    }

    const globalTechClient = createdClients[0];

    // -----------------------------------------------------------------------
    // 4.4  Templates
    // -----------------------------------------------------------------------
    interface TemplateSeed {
      name: string;
      templateType: TemplateType;
      isDefault: boolean;
      sections: string[];
      description: string;
    }

    const templateSeeds: TemplateSeed[] = [
      {
        name: '竞品调研访谈',
        // 'structured' → interview-style, best match in the TemplateType enum
        templateType: TemplateType.INTERVIEW,
        isDefault: true,
        sections: ['背景了解', '痛点挖掘', '产品反馈', '竞品对比'],
        description: '用于竞争产品调研的结构化访谈模板',
      },
      {
        name: '用户需求挖掘',
        // 'semi_structured' → questionnaire-style free-form variant
        templateType: TemplateType.QUESTIONNAIRE,
        isDefault: false,
        sections: ['用户背景', '使用场景', '核心需求', '改进建议'],
        description: '深度挖掘用户核心需求的半结构化访谈模板',
      },
    ];

    for (const seedTemplate of templateSeeds) {
      const existing = await templateRepo.findOne({
        where: { tenantId: tenant.id, name: seedTemplate.name },
      });

      if (!existing) {
        const departments = seedTemplate.sections.map((sectionName) => ({
          name: sectionName,
          code: sectionName,
          description: '',
          questions: [] as Array<{ content: string; type: string; isRequired: boolean }>,
        }));

        const template = templateRepo.create({
          tenantId: tenant.id,
          createdBy: expertUser?.id ?? null,
          name: seedTemplate.name,
          templateType: seedTemplate.templateType,
          description: seedTemplate.description,
          scope: TemplateScope.TENANT,
          isDefault: seedTemplate.isDefault,
          isActive: true,
          usageCount: 0,
          tags: [],
          variables: {},
          metadata: {},
          content: {
            departments,
            settings: {},
          },
        });

        const saved = await templateRepo.save(template);
        console.log(`✅ Created template: ${seedTemplate.name}  (id: ${saved.id})`);
      } else {
        console.log(`⏭️  Template already exists: ${seedTemplate.name}`);
      }
    }

    // -----------------------------------------------------------------------
    // 4.5  Interview session
    // -----------------------------------------------------------------------
    const sessionTitle = 'GlobalTech 金融科技需求访谈';

    const existingSession = await sessionRepo.findOne({
      where: { tenantId: tenant.id, title: sessionTitle },
    });

    if (!existingSession) {
      const interviewDate = new Date();
      interviewDate.setDate(interviewDate.getDate() + 3);

      const session = sessionRepo.create({
        tenantId: tenant.id,
        title: sessionTitle,
        description: '了解 GlobalTech 在跨境支付合规方面的痛点',
        status: InterviewStatus.SCHEDULED,
        clientId: globalTechClient?.id ?? null,
        interviewerId: expertUser?.id ?? null,
        interviewDate,
        language: 'zh-CN',
      });

      const saved = await sessionRepo.save(session);
      console.log(`✅ Created session: ${session.title}  (id: ${saved.id})`);
      console.log(`   ↳ Interview date: ${interviewDate.toISOString()}`);
    } else {
      console.log(`⏭️  Session already exists: ${sessionTitle}`);
    }

    // -----------------------------------------------------------------------
    // 5. Commit
    // -----------------------------------------------------------------------
    await queryRunner.commitTransaction();

    console.log('\n✅ Seed completed successfully.\n');
    console.log('Demo credentials:');
    console.log('  admin@openclaw.io   →  Admin@123456');
    console.log('  sales@openclaw.io   →  Sales@123456');
    console.log('  expert@openclaw.io  →  Expert@123456');
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error('\n❌ Seed failed — transaction rolled back.');
    throw err;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
seed().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`❌ Fatal: ${message}`);
  process.exit(1);
});
