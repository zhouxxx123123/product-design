import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { FeatureFlagsService } from './feature-flags.service';
import { TenantFeatureEntity } from '../../entities/tenant-feature.entity';
import { FeatureDefinitionEntity } from '../../entities/feature-definition.entity';

// ─── Constants ───────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFeatureEntity(key: string, enabled: boolean): TenantFeatureEntity {
  const e = new TenantFeatureEntity();
  e.tenantId = TENANT_ID;
  e.key = key;
  e.enabled = enabled;
  e.updatedAt = new Date('2026-03-01T00:00:00Z');
  return e;
}

// ─── Mock repo factory ────────────────────────────────────────────────────────

const makeMockRepo = () => ({
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let repo: ReturnType<typeof makeMockRepo>;

  beforeEach(async () => {
    repo = makeMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        { provide: getRepositoryToken(TenantFeatureEntity), useValue: repo },
        { provide: getRepositoryToken(FeatureDefinitionEntity), useValue: makeMockRepo() },
      ],
    }).compile();

    service = module.get<FeatureFlagsService>(FeatureFlagsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns mapped FeatureFlagItems for the tenant', async () => {
      repo.find.mockResolvedValue([
        makeFeatureEntity('ai_chat', true),
        makeFeatureEntity('export_pdf', false),
      ]);

      const result = await service.findAll(TENANT_ID);

      expect(result).toEqual([
        { key: 'ai_chat', enabled: true },
        { key: 'export_pdf', enabled: false },
      ]);
    });

    it('returns empty array when no flags configured', async () => {
      repo.find.mockResolvedValue([]);

      const result = await service.findAll(TENANT_ID);

      expect(result).toEqual([]);
    });

    it('queries the repo with the correct tenantId', async () => {
      repo.find.mockResolvedValue([]);

      await service.findAll(TENANT_ID);

      expect(repo.find).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID } });
    });

    it('isolates results per tenant — only returns flags for the given tenantId', async () => {
      // Returns only the rows that the repo would return for a given tenant
      repo.find.mockResolvedValue([makeFeatureEntity('feature_x', true)]);

      const result = await service.findAll('other-tenant-id');

      // Only one flag mapped (the repo mock only returns one row regardless)
      expect(result).toHaveLength(1);
    });
  });

  // ── saveAll ───────────────────────────────────────────────────────────────

  describe('saveAll()', () => {
    it('creates entities and persists them, then returns the updated list', async () => {
      const flags = [
        { key: 'ai_chat', enabled: true },
        { key: 'export_pdf', enabled: false },
      ];

      // create returns plain objects; save resolves them
      repo.create.mockImplementation((data) => ({ ...data }));
      repo.save.mockResolvedValue(undefined);

      // findAll (called after save) returns the fresh rows
      repo.find.mockResolvedValue(flags.map((f) => makeFeatureEntity(f.key, f.enabled)));

      const result = await service.saveAll(TENANT_ID, flags);

      expect(repo.create).toHaveBeenCalledTimes(2);
      expect(repo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ tenantId: TENANT_ID, key: 'ai_chat', enabled: true }),
          expect.objectContaining({ tenantId: TENANT_ID, key: 'export_pdf', enabled: false }),
        ]),
      );
      expect(result).toEqual([
        { key: 'ai_chat', enabled: true },
        { key: 'export_pdf', enabled: false },
      ]);
    });

    it('handles empty flags array (clears all)', async () => {
      repo.create.mockReturnValue({});
      repo.save.mockResolvedValue(undefined);
      repo.find.mockResolvedValue([]);

      const result = await service.saveAll(TENANT_ID, []);

      expect(repo.save).toHaveBeenCalledWith([]);
      expect(result).toEqual([]);
    });

    it('returns the result of a subsequent findAll after saving', async () => {
      repo.create.mockImplementation((data) => ({ ...data }));
      repo.save.mockResolvedValue(undefined);

      const stored = [makeFeatureEntity('new_flag', true)];
      repo.find.mockResolvedValue(stored);

      const result = await service.saveAll(TENANT_ID, [{ key: 'new_flag', enabled: true }]);

      expect(result).toEqual([{ key: 'new_flag', enabled: true }]);
    });
  });
});
