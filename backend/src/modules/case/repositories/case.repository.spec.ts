import { DataSource } from 'typeorm';
import { CaseRepository } from './case.repository';
import { CaseEntity, CaseType, CaseStatus } from '../../../entities/case.entity';
import { buildVectorString } from '../../../database/vector-column-type';

// ─── Constants ───────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const CASE_ID = 'case-uuid-001';
const TEST_VECTOR = [0.1, 0.2, 0.3];
const VECTOR_STRING = '[0.1,0.2,0.3]';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCase(overrides: Partial<CaseEntity> = {}): CaseEntity {
  const c = new CaseEntity();
  c.id = CASE_ID;
  c.tenantId = TENANT_ID;
  c.createdBy = 'user-uuid-001';
  c.title = 'Test Case';
  c.industry = 'Technology';
  c.caseType = CaseType.RESEARCH;
  c.content = 'Test content';
  c.summary = 'Test summary';
  c.tags = ['test'];
  c.metadata = {};
  c.isPublic = true;
  c.status = CaseStatus.PUBLISHED;
  c.embedding = null;
  c.createdAt = new Date('2026-03-01T00:00:00Z');
  c.updatedAt = new Date('2026-03-01T00:00:00Z');
  c.deletedAt = null;
  return Object.assign(c, overrides);
}

function makeMockDbRow(overrides: Record<string, any> = {}): Record<string, unknown> {
  return {
    id: CASE_ID,
    tenant_id: TENANT_ID,
    created_by: 'user-uuid-001',
    title: 'Test Case',
    industry: 'Technology',
    case_type: CaseType.RESEARCH,
    content: 'Test content',
    summary: 'Test summary',
    tags: ['test'],
    metadata: {},
    is_public: true,
    status: CaseStatus.PUBLISHED,
    created_at: new Date('2026-03-01T00:00:00Z'),
    updated_at: new Date('2026-03-01T00:00:00Z'),
    deleted_at: null,
    similarity: '0.91',
    distance: '0.09',
    ...overrides,
  };
}

// ─── Mock setup ──────────────────────────────────────────────────────────────

const mockManager = {
  create: jest.fn((EntityClass) => new EntityClass()),
};

const mockDataSource = {
  createEntityManager: jest.fn(() => mockManager),
  query: jest.fn(),
} as unknown as DataSource;

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('CaseRepository', () => {
  let repository: CaseRepository;

  beforeEach(() => {
    repository = new CaseRepository(mockDataSource);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── searchSimilar ─────────────────────────────────────────────────────────

  describe('searchSimilar', () => {
    it('calls dataSource.query with vectorStr, tenantId, minSimilarity, limit', async () => {
      const mockRows = [makeMockDbRow()];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);

      await repository.searchSimilar(TENANT_ID, TEST_VECTOR, 5, 0.7);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('1 - (embedding <=> $1::vector) AS similarity'),
        [VECTOR_STRING, TENANT_ID, 0.7, 5]
      );
    });

    it('uses default limit=10 and minSimilarity=0.8 when not provided', async () => {
      const mockRows = [makeMockDbRow()];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);

      await repository.searchSimilar(TENANT_ID, TEST_VECTOR);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.any(String),
        [VECTOR_STRING, TENANT_ID, 0.8, 10]
      );
    });

    it('maps snake_case DB columns to camelCase entity fields', async () => {
      const mockRows = [
        makeMockDbRow({
          case_type: CaseType.PROJECT,
          is_public: false,
          created_by: 'creator-id',
          created_at: new Date('2026-03-01T10:00:00Z'),
          updated_at: new Date('2026-03-01T11:00:00Z'),
          deleted_at: new Date('2026-03-01T12:00:00Z'),
        }),
      ];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);

      const result = await repository.searchSimilar(TENANT_ID, TEST_VECTOR);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        caseType: CaseType.PROJECT,
        isPublic: false,
        createdBy: 'creator-id',
        createdAt: new Date('2026-03-01T10:00:00Z'),
        updatedAt: new Date('2026-03-01T11:00:00Z'),
        deletedAt: new Date('2026-03-01T12:00:00Z'),
      });
    });

    it('parses similarity as float from string', async () => {
      const mockRows = [makeMockDbRow({ similarity: '0.87654' })];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);

      const result = await repository.searchSimilar(TENANT_ID, TEST_VECTOR);

      expect(result[0].similarity).toBe(0.87654);
      expect(typeof result[0].similarity).toBe('number');
    });

    it('returns empty array when dataSource.query returns []', async () => {
      (mockDataSource.query as jest.Mock).mockResolvedValue([]);

      const result = await repository.searchSimilar(TENANT_ID, TEST_VECTOR);

      expect(result).toEqual([]);
    });

    it('creates entity instances using manager.create', async () => {
      const mockRows = [makeMockDbRow()];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);
      mockManager.create.mockReturnValue(new CaseEntity());

      await repository.searchSimilar(TENANT_ID, TEST_VECTOR);

      expect(mockManager.create).toHaveBeenCalledWith(CaseEntity);
    });
  });

  // ── searchSimilarApproximate ──────────────────────────────────────────────

  describe('searchSimilarApproximate', () => {
    it('calls SET LOCAL ivfflat.probes = N before main query', async () => {
      const mockRows = [makeMockDbRow({ distance: '0.15' })];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);

      await repository.searchSimilarApproximate(TENANT_ID, TEST_VECTOR, 25, 8);

      expect(mockDataSource.query).toHaveBeenCalledWith('SET LOCAL ivfflat.probes = 25');
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('embedding <=> $1::vector AS distance'),
        [VECTOR_STRING, TENANT_ID, 8]
      );
    });

    it('calls SET LOCAL ivfflat.probes = 1 in finally even when main query throws', async () => {
      (mockDataSource.query as jest.Mock)
        .mockResolvedValueOnce(undefined) // SET probes=15
        .mockRejectedValueOnce(new Error('Query failed')) // Main query throws
        .mockResolvedValueOnce(undefined); // SET probes=1 in finally

      await expect(
        repository.searchSimilarApproximate(TENANT_ID, TEST_VECTOR, 15, 5)
      ).rejects.toThrow('Query failed');

      expect(mockDataSource.query).toHaveBeenCalledWith('SET LOCAL ivfflat.probes = 15');
      expect(mockDataSource.query).toHaveBeenCalledWith('SET LOCAL ivfflat.probes = 1');
    });

    it('maps distance and computes similarity = 1 - distance', async () => {
      const mockRows = [makeMockDbRow({ distance: '0.25' })];
      (mockDataSource.query as jest.Mock)
        .mockResolvedValueOnce(undefined) // SET probes
        .mockResolvedValueOnce(mockRows) // Main query
        .mockResolvedValueOnce(undefined); // Reset probes

      const result = await repository.searchSimilarApproximate(TENANT_ID, TEST_VECTOR);

      expect(result[0]).toMatchObject({
        distance: 0.25,
        similarity: 0.75, // 1 - 0.25
      });
    });

    it('uses default probes=10 and limit=10', async () => {
      const mockRows = [makeMockDbRow()];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);

      await repository.searchSimilarApproximate(TENANT_ID, TEST_VECTOR);

      expect(mockDataSource.query).toHaveBeenCalledWith('SET LOCAL ivfflat.probes = 10');
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.any(String),
        [VECTOR_STRING, TENANT_ID, 10]
      );
    });

    it('maps snake_case fields to camelCase', async () => {
      const mockRows = [
        makeMockDbRow({
          case_type: CaseType.TEMPLATE,
          is_public: true,
          created_by: 'author-id',
          distance: '0.1',
        }),
      ];
      (mockDataSource.query as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(mockRows)
        .mockResolvedValueOnce(undefined);

      const result = await repository.searchSimilarApproximate(TENANT_ID, TEST_VECTOR);

      expect(result[0]).toMatchObject({
        caseType: CaseType.TEMPLATE,
        isPublic: true,
        createdBy: 'author-id',
      });
    });
  });

  // ── updateEmbedding ───────────────────────────────────────────────────────

  describe('updateEmbedding', () => {
    it('calls dataSource.query with correct UPDATE SQL and [vectorStr, caseId]', async () => {
      (mockDataSource.query as jest.Mock).mockResolvedValue(undefined);

      await repository.updateEmbedding(CASE_ID, TEST_VECTOR);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        'UPDATE cases SET embedding = $1::vector WHERE id = $2',
        [VECTOR_STRING, CASE_ID]
      );
    });

    it('builds vector string correctly', async () => {
      (mockDataSource.query as jest.Mock).mockResolvedValue(undefined);
      const longVector = [0.1, 0.2, 0.3, 0.4, 0.5];

      await repository.updateEmbedding(CASE_ID, longVector);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.any(String),
        ['[0.1,0.2,0.3,0.4,0.5]', CASE_ID]
      );
    });
  });

  // ── batchUpdateEmbeddings ─────────────────────────────────────────────────

  describe('batchUpdateEmbeddings', () => {
    it('returns immediately without querying when updates is empty array', async () => {
      await repository.batchUpdateEmbeddings([]);

      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it('builds correct parameterized VALUES for 2 items', async () => {
      const updates = [
        { caseId: 'case-1', embedding: [0.1, 0.2] },
        { caseId: 'case-2', embedding: [0.3, 0.4] },
      ];
      (mockDataSource.query as jest.Mock).mockResolvedValue(undefined);

      await repository.batchUpdateEmbeddings(updates);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('VALUES ($1::uuid, $2::vector), ($3::uuid, $4::vector)'),
        ['case-1', '[0.1,0.2]', 'case-2', '[0.3,0.4]']
      );
    });

    it('passes flattened [caseId1, vectorStr1, caseId2, vectorStr2] as params', async () => {
      const updates = [
        { caseId: 'alpha', embedding: [1.0] },
        { caseId: 'beta', embedding: [2.0] },
        { caseId: 'gamma', embedding: [3.0] },
      ];
      (mockDataSource.query as jest.Mock).mockResolvedValue(undefined);

      await repository.batchUpdateEmbeddings(updates);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.any(String),
        ['alpha', '[1]', 'beta', '[2]', 'gamma', '[3]']
      );
    });

    it('builds correct VALUES clause for single update', async () => {
      const updates = [{ caseId: 'single', embedding: [0.9, 0.8] }];
      (mockDataSource.query as jest.Mock).mockResolvedValue(undefined);

      await repository.batchUpdateEmbeddings(updates);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('VALUES ($1::uuid, $2::vector)'),
        ['single', '[0.9,0.8]']
      );
    });
  });

  // ── findCasesWithoutEmbedding ─────────────────────────────────────────────

  describe('findCasesWithoutEmbedding', () => {
    let mockQb: any;

    beforeEach(() => {
      mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(mockQb);
    });

    it('calls createQueryBuilder and chains where/andWhere/limit', async () => {
      await repository.findCasesWithoutEmbedding();

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('case');
      expect(mockQb.where).toHaveBeenCalledWith('case.embedding IS NULL');
      expect(mockQb.andWhere).toHaveBeenCalledWith('case.deletedAt IS NULL');
      expect(mockQb.limit).toHaveBeenCalledWith(100);
      expect(mockQb.getMany).toHaveBeenCalled();
    });

    it('adds tenantId filter when tenantId is provided', async () => {
      await repository.findCasesWithoutEmbedding(TENANT_ID);

      expect(mockQb.andWhere).toHaveBeenCalledWith('case.tenantId = :tenantId', {
        tenantId: TENANT_ID,
      });
    });

    it('does NOT add tenantId filter when tenantId is undefined', async () => {
      await repository.findCasesWithoutEmbedding(undefined);

      const tenantCalls = (mockQb.andWhere as jest.Mock).mock.calls.filter((call) =>
        call[0].includes('tenantId')
      );
      expect(tenantCalls).toHaveLength(0);
    });

    it('uses custom limit when provided', async () => {
      await repository.findCasesWithoutEmbedding(TENANT_ID, 50);

      expect(mockQb.limit).toHaveBeenCalledWith(50);
    });

    it('returns result from getMany', async () => {
      const mockCases = [makeCase()];
      mockQb.getMany.mockResolvedValue(mockCases);

      const result = await repository.findCasesWithoutEmbedding();

      expect(result).toBe(mockCases);
    });
  });

  // ── buildVectorString utility ────────────────────────────────────────────

  describe('buildVectorString usage', () => {
    it('uses buildVectorString function correctly', () => {
      expect(buildVectorString([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]');
      expect(buildVectorString([1, 2])).toBe('[1,2]');
      expect(buildVectorString([])).toBe('[]');
    });
  });
});