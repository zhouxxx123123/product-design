import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { DictionaryService } from './dictionary.service';
import { DictionaryNodeEntity } from '../../entities/dictionary-node.entity';

// ─── Constants ───────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const NODE_ID = 'node-uuid-001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<DictionaryNodeEntity> = {}): DictionaryNodeEntity {
  const n = new DictionaryNodeEntity();
  n.id = NODE_ID;
  n.tenantId = TENANT_ID;
  n.name = '根节点';
  n.code = 'ROOT';
  n.parentId = null;
  n.level = 1;
  n.description = null;
  n.sortOrder = 0;
  n.createdAt = new Date('2026-03-01T00:00:00Z');
  n.updatedAt = new Date('2026-03-01T00:00:00Z');
  n.deletedAt = null;
  return Object.assign(n, overrides);
}

// ─── Mock repo factory ────────────────────────────────────────────────────────

const makeMockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('DictionaryService', () => {
  let service: DictionaryService;
  let repo: ReturnType<typeof makeMockRepo>;

  beforeEach(async () => {
    repo = makeMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DictionaryService,
        { provide: getRepositoryToken(DictionaryNodeEntity), useValue: repo },
      ],
    }).compile();

    service = module.get<DictionaryService>(DictionaryService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns an array of nodes for a tenant', async () => {
      const nodes = [makeNode()];
      repo.find.mockResolvedValue(nodes);

      const result = await service.findAll(TENANT_ID);

      expect(result).toEqual(nodes);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }),
      );
    });

    it('returns empty array when no nodes exist', async () => {
      repo.find.mockResolvedValue([]);

      const result = await service.findAll(TENANT_ID);

      expect(result).toEqual([]);
    });

    it('filters by parentId when provided', async () => {
      repo.find.mockResolvedValue([]);

      await service.findAll(TENANT_ID, 'parent-id-001');

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ parentId: 'parent-id-001' }),
        }),
      );
    });

    it('filters by parentId=null (top-level) when parentId is empty string', async () => {
      repo.find.mockResolvedValue([]);

      await service.findAll(TENANT_ID, '');

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ parentId: null }),
        }),
      );
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns the node when found', async () => {
      const node = makeNode();
      repo.findOne.mockResolvedValue(node);

      const result = await service.findById(NODE_ID, TENANT_ID);

      expect(result).toBe(node);
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: NODE_ID, tenantId: TENANT_ID }),
        }),
      );
    });

    it('throws NotFoundException when node does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent', TENANT_ID)).rejects.toThrow(NotFoundException);
    });

    it('NotFoundException message contains the node id', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent-id', TENANT_ID)).rejects.toThrow(/nonexistent-id/);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a root node (level=1) when no parentId supplied', async () => {
      const node = makeNode({ level: 1 });
      repo.create.mockReturnValue(node);
      repo.save.mockResolvedValue(node);

      const result = await service.create(TENANT_ID, { name: '根节点' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_ID, level: 1 }),
      );
      expect(result).toBe(node);
    });

    it('creates a child node with level = parent.level + 1', async () => {
      const parent = makeNode({ id: 'parent-001', level: 1 });
      const child = makeNode({ id: 'child-001', level: 2, parentId: 'parent-001' });
      // findById is called to load the parent
      repo.findOne.mockResolvedValue(parent);
      repo.create.mockReturnValue(child);
      repo.save.mockResolvedValue(child);

      const result = await service.create(TENANT_ID, { name: '子节点', parentId: 'parent-001' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ level: 2, parentId: 'parent-001' }),
      );
      expect(result).toBe(child);
    });

    it('throws NotFoundException when parentId refers to a non-existent node', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, { name: '孤节点', parentId: 'ghost-parent' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates node fields and returns saved entity', async () => {
      const node = makeNode();
      repo.findOne.mockResolvedValue(node);
      repo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(NODE_ID, TENANT_ID, {
        name: '更新节点名',
        sortOrder: 5,
      });

      expect(result.name).toBe('更新节点名');
      expect(result.sortOrder).toBe(5);
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when node does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent', TENANT_ID, { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── softDelete ────────────────────────────────────────────────────────────

  describe('softDelete()', () => {
    it('sets deletedAt on the node and returns { success: true }', async () => {
      const node = makeNode();
      // findOne is called in findById (main node) and in cascadeSoftDelete (children find → empty)
      repo.findOne.mockResolvedValue(node);
      repo.find.mockResolvedValue([]); // no children
      repo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.softDelete(NODE_ID, TENANT_ID);

      expect(result).toEqual({ success: true });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
    });

    it('throws NotFoundException when node does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.softDelete('nonexistent', TENANT_ID)).rejects.toThrow(NotFoundException);
    });

    it('cascade soft-deletes children before deleting parent', async () => {
      const parent = makeNode({ id: 'parent-001' });
      const child = makeNode({ id: 'child-001', parentId: 'parent-001' });

      // findOne for findById(parent)
      repo.findOne.mockResolvedValue(parent);
      // cascadeSoftDelete: find children of parent → [child]; find children of child → []
      repo.find
        .mockResolvedValueOnce([child]) // children of parent
        .mockResolvedValueOnce([]); // children of child
      repo.save.mockImplementation((entity) => Promise.resolve(entity));

      await service.softDelete('parent-001', TENANT_ID);

      // save called at least twice: once for child, once for parent
      expect(repo.save.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
