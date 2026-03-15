import { DataSource } from 'typeorm';
import { CaseFeatureRepository } from './case-feature.repository';
import { CaseFeatureEntity, FeatureCategory } from '../../../entities/case-feature.entity';
import { CaseType } from '../../../entities/case.entity';
import { buildVectorString } from '../../../database/vector-column-type';

// ─── Constants ───────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const CASE_ID = 'case-uuid-001';
const FEATURE_ID = 'feature-uuid-001';
const TEST_VECTOR = [0.1, 0.2, 0.3];
const VECTOR_STRING = '[0.1,0.2,0.3]';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCaseFeature(overrides: Partial<CaseFeatureEntity> = {}): CaseFeatureEntity {
  const f = new CaseFeatureEntity();
  f.id = FEATURE_ID;
  f.caseId = CASE_ID;
  f.category = FeatureCategory.PAIN_POINT;
  f.content = 'Test feature content';
  f.summary = 'Test summary';
  f.evidence = null;
  f.importanceScore = 8.5;
  f.sortOrder = 1;
  f.embedding = null;
  f.metadata = {};
  f.createdAt = new Date('2026-03-01T00:00:00Z');
  f.updatedAt = new Date('2026-03-01T00:00:00Z');
  f.deletedAt = null;
  return Object.assign(f, overrides);
}

function makeMockFeatureRow(overrides: Record<string, any> = {}): Record<string, unknown> {
  return {
    // Feature fields (snake_case from DB)
    id: FEATURE_ID,
    case_id: CASE_ID,
    category: FeatureCategory.PAIN_POINT,
    content: 'Test feature content',
    summary: 'Test summary',
    importance_score: 8.5,
    sort_order: 1,
    metadata: {},
    created_at: new Date('2026-03-01T00:00:00Z'),
    updated_at: new Date('2026-03-01T00:00:00Z'),
    deleted_at: null,
    // Case fields (for searchSimilarFeatures)
    case_id_ref: CASE_ID,
    case_title: 'Test Case Title',
    case_industry: 'Technology',
    case_case_type: CaseType.RESEARCH,
    // Search fields
    similarity: '0.87',
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

describe('CaseFeatureRepository', () => {
  let repository: CaseFeatureRepository;

  beforeEach(() => {
    repository = new CaseFeatureRepository(mockDataSource);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── searchSimilarFeatures ────────────────────────────────────────────────

  describe('searchSimilarFeatures', () => {
    it('calls query without category filter when category not provided', async () => {
      const mockRows = [makeMockFeatureRow()];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);

      await repository.searchSimilarFeatures(TENANT_ID, TEST_VECTOR, { limit: 15 });

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.not.stringContaining('AND cf.category ='),
        [VECTOR_STRING, TENANT_ID, 0.7, 15],
      );
    });

    it('calls query WITH category filter when category is provided', async () => {
      const mockRows = [makeMockFeatureRow()];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);

      await repository.searchSimilarFeatures(TENANT_ID, TEST_VECTOR, {
        category: FeatureCategory.PAIN_POINT,
        limit: 25,
      });

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('AND cf.category = $4'),
        [VECTOR_STRING, TENANT_ID, 0.7, FeatureCategory.PAIN_POINT, 25],
      );
    });

    it('limit is always the last param', async () => {
      const mockRows = [makeMockFeatureRow()];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);

      // Test without category (4 params total)
      await repository.searchSimilarFeatures(TENANT_ID, TEST_VECTOR, { limit: 12 });
      expect(mockDataSource.query).toHaveBeenLastCalledWith(expect.stringContaining('LIMIT $4'), [
        VECTOR_STRING,
        TENANT_ID,
        0.7,
        12,
      ]);

      jest.clearAllMocks();

      // Test with category (5 params total)
      await repository.searchSimilarFeatures(TENANT_ID, TEST_VECTOR, {
        category: FeatureCategory.SOLUTION,
        limit: 18,
      });
      expect(mockDataSource.query).toHaveBeenLastCalledWith(expect.stringContaining('LIMIT $5'), [
        VECTOR_STRING,
        TENANT_ID,
        0.7,
        FeatureCategory.SOLUTION,
        18,
      ]);
    });

    it('maps feature camelCase fields correctly', async () => {
      const mockRows = [
        makeMockFeatureRow({
          case_id: 'case-abc',
          importance_score: 9.2,
          sort_order: 3,
          created_at: new Date('2026-03-02T10:00:00Z'),
          updated_at: new Date('2026-03-02T11:00:00Z'),
          deleted_at: new Date('2026-03-02T12:00:00Z'),
        }),
      ];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);

      const result = await repository.searchSimilarFeatures(TENANT_ID, TEST_VECTOR);

      expect(result).toHaveLength(1);
      expect(result[0].feature).toMatchObject({
        caseId: 'case-abc',
        importanceScore: 9.2,
        sortOrder: 3,
        createdAt: new Date('2026-03-02T10:00:00Z'),
        updatedAt: new Date('2026-03-02T11:00:00Z'),
        deletedAt: new Date('2026-03-02T12:00:00Z'),
      });
    });

    it('maps caseItem fields correctly', async () => {
      const mockRows = [
        makeMockFeatureRow({
          case_id_ref: 'case-xyz',
          case_title: 'Enterprise SaaS Case Study',
          case_industry: 'Finance',
          case_case_type: CaseType.PROJECT,
        }),
      ];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);

      const result = await repository.searchSimilarFeatures(TENANT_ID, TEST_VECTOR);

      expect(result[0].caseItem).toMatchObject({
        id: 'case-xyz',
        title: 'Enterprise SaaS Case Study',
        industry: 'Finance',
        caseType: CaseType.PROJECT,
      });
    });

    it('parses similarity as float', async () => {
      const mockRows = [makeMockFeatureRow({ similarity: '0.93456' })];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);

      const result = await repository.searchSimilarFeatures(TENANT_ID, TEST_VECTOR);

      expect(result[0].similarity).toBe(0.93456);
      expect(typeof result[0].similarity).toBe('number');
    });

    it('uses defaults limit=20, minSimilarity=0.7 when options not provided', async () => {
      const mockRows = [makeMockFeatureRow()];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);

      await repository.searchSimilarFeatures(TENANT_ID, TEST_VECTOR);

      expect(mockDataSource.query).toHaveBeenCalledWith(expect.any(String), [
        VECTOR_STRING,
        TENANT_ID,
        0.7,
        20,
      ]);
    });

    it('applies custom minSimilarity when provided', async () => {
      const mockRows = [makeMockFeatureRow()];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);

      await repository.searchSimilarFeatures(TENANT_ID, TEST_VECTOR, { minSimilarity: 0.85 });

      expect(mockDataSource.query).toHaveBeenCalledWith(expect.any(String), [
        VECTOR_STRING,
        TENANT_ID,
        0.85,
        20,
      ]);
    });

    it('creates feature entity using manager.create', async () => {
      const mockRows = [makeMockFeatureRow()];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);
      mockManager.create.mockReturnValue(new CaseFeatureEntity());

      await repository.searchSimilarFeatures(TENANT_ID, TEST_VECTOR);

      expect(mockManager.create).toHaveBeenCalledWith(CaseFeatureEntity);
    });

    it('returns empty array when no results found', async () => {
      (mockDataSource.query as jest.Mock).mockResolvedValue([]);

      const result = await repository.searchSimilarFeatures(TENANT_ID, TEST_VECTOR);

      expect(result).toEqual([]);
    });
  });

  // ── findMostRelevantInCase ────────────────────────────────────────────────

  describe('findMostRelevantInCase', () => {
    it('calls dataSource.query with [vectorStr, caseId, limit]', async () => {
      const mockRows = [makeMockFeatureRow()];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);

      await repository.findMostRelevantInCase(CASE_ID, TEST_VECTOR, 8);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE case_id = $2'),
        [VECTOR_STRING, CASE_ID, 8],
      );
    });

    it('maps to CaseFeatureEntity with camelCase fields and similarity', async () => {
      const mockRows = [
        makeMockFeatureRow({
          case_id: 'case-def',
          importance_score: 7.8,
          sort_order: 2,
          similarity: '0.91',
          created_at: new Date('2026-03-03T10:00:00Z'),
          updated_at: new Date('2026-03-03T11:00:00Z'),
          deleted_at: null,
        }),
      ];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);

      const result = await repository.findMostRelevantInCase(CASE_ID, TEST_VECTOR);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        caseId: 'case-def',
        importanceScore: 7.8,
        sortOrder: 2,
        similarity: 0.91,
        createdAt: new Date('2026-03-03T10:00:00Z'),
        updatedAt: new Date('2026-03-03T11:00:00Z'),
        deletedAt: null,
      });
    });

    it('uses default limit=5', async () => {
      const mockRows = [makeMockFeatureRow()];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);

      await repository.findMostRelevantInCase(CASE_ID, TEST_VECTOR);

      expect(mockDataSource.query).toHaveBeenCalledWith(expect.any(String), [
        VECTOR_STRING,
        CASE_ID,
        5,
      ]);
    });

    it('parses similarity correctly', async () => {
      const mockRows = [makeMockFeatureRow({ similarity: '0.12345' })];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);

      const result = await repository.findMostRelevantInCase(CASE_ID, TEST_VECTOR);

      expect(result[0].similarity).toBe(0.12345);
    });

    it('creates entity using manager.create', async () => {
      const mockRows = [makeMockFeatureRow()];
      (mockDataSource.query as jest.Mock).mockResolvedValue(mockRows);
      mockManager.create.mockReturnValue(new CaseFeatureEntity());

      await repository.findMostRelevantInCase(CASE_ID, TEST_VECTOR);

      expect(mockManager.create).toHaveBeenCalledWith(CaseFeatureEntity);
    });
  });

  // ── updateEmbedding ───────────────────────────────────────────────────────

  describe('updateEmbedding', () => {
    it('calls dataSource.query with UPDATE SQL, vectorStr, featureId', async () => {
      (mockDataSource.query as jest.Mock).mockResolvedValue(undefined);

      await repository.updateEmbedding(FEATURE_ID, TEST_VECTOR);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        'UPDATE case_features SET embedding = $1::vector WHERE id = $2',
        [VECTOR_STRING, FEATURE_ID],
      );
    });

    it('builds vector string correctly for different vectors', async () => {
      (mockDataSource.query as jest.Mock).mockResolvedValue(undefined);
      const customVector = [1.5, 2.7, 3.9, 4.1];

      await repository.updateEmbedding('feat-123', customVector);

      expect(mockDataSource.query).toHaveBeenCalledWith(expect.any(String), [
        '[1.5,2.7,3.9,4.1]',
        'feat-123',
      ]);
    });
  });

  // ── findByCaseId ──────────────────────────────────────────────────────────

  describe('findByCaseId', () => {
    beforeEach(() => {
      jest.spyOn(repository, 'find').mockResolvedValue([]);
    });

    it('calls this.find with correct where and order options', async () => {
      await repository.findByCaseId(CASE_ID);

      expect(repository.find).toHaveBeenCalledWith({
        where: { caseId: CASE_ID },
        order: { importanceScore: 'DESC', sortOrder: 'ASC' },
      });
    });

    it('returns result from this.find', async () => {
      const mockFeatures = [makeCaseFeature()];
      (repository.find as jest.Mock).mockResolvedValue(mockFeatures);

      const result = await repository.findByCaseId(CASE_ID);

      expect(result).toBe(mockFeatures);
    });

    it('works with different caseId', async () => {
      const customCaseId = 'custom-case-id';
      await repository.findByCaseId(customCaseId);

      expect(repository.find).toHaveBeenCalledWith({
        where: { caseId: customCaseId },
        order: { importanceScore: 'DESC', sortOrder: 'ASC' },
      });
    });
  });

  // ── buildVectorString utility ────────────────────────────────────────────

  describe('buildVectorString usage', () => {
    it('correctly formats vectors for PostgreSQL', () => {
      expect(buildVectorString([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]');
      expect(buildVectorString([1.0, -0.5, 2.25])).toBe('[1,-0.5,2.25]');
      expect(buildVectorString([])).toBe('[]');
      expect(buildVectorString([42])).toBe('[42]');
    });
  });
});
