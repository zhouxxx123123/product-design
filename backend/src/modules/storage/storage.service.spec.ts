import * as path from 'path';

// Mock the entire fs module before any imports that reference it.
jest.mock('fs');
import * as fs from 'fs';

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';

import { StorageService } from './storage.service';
import { StorageFileEntity } from '../../entities/storage-file.entity';

// ─── Constants ───────────────────────────────────────────────────────────────

const UPLOAD_DIR = './uploads';
const FILE_ID_PATTERN = /^[0-9a-f-]{36}$/i;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMulterFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'recording.wav',
    encoding: '7bit',
    mimetype: 'audio/wav',
    size: 204800,
    destination: '/tmp/uploads',
    filename: 'tmp-uuid.wav',
    path: '/tmp/uploads/tmp-uuid.wav',
    buffer: Buffer.alloc(0),
    stream: null as any,
    ...overrides,
  };
}

// Typed mocked fs helpers
const mockedExistsSync = jest.mocked(fs.existsSync);
const mockedMkdirSync = jest.mocked(fs.mkdirSync);
const mockedRenameSync = jest.mocked(fs.renameSync);
const mockedReaddirSync = jest.mocked(fs.readdirSync);

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('StorageService', () => {
  let service: StorageService;
  let mockConfigService: { get: jest.Mock };
  let mockStorageFileRepo: {
    insert: jest.Mock;
    find: jest.Mock;
    softDelete: jest.Mock;
    update: jest.Mock;
  };

  async function buildService(): Promise<StorageService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(StorageFileEntity), useValue: mockStorageFileRepo },
      ],
    }).compile();
    return module.get<StorageService>(StorageService);
  }

  beforeEach(() => {
    mockConfigService = { get: jest.fn().mockReturnValue(UPLOAD_DIR) };
    mockStorageFileRepo = {
      insert: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
      softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
    };

    // Default stubs: directory already exists
    mockedExistsSync.mockReturnValue(true);
    mockedMkdirSync.mockReturnValue(undefined as any);
    mockedRenameSync.mockReturnValue(undefined);
    mockedReaddirSync.mockReturnValue([] as any);
  });

  afterEach(() => jest.clearAllMocks());

  // ── constructor ───────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('reads UPLOAD_DIR from ConfigService', async () => {
      await buildService();

      expect(mockConfigService.get).toHaveBeenCalledWith('UPLOAD_DIR', './uploads');
    });

    it('does not call mkdirSync when the upload directory already exists', async () => {
      mockedExistsSync.mockReturnValue(true);

      await buildService();

      expect(mockedMkdirSync).not.toHaveBeenCalled();
    });

    it('calls mkdirSync with recursive:true when the upload directory does not exist', async () => {
      mockedExistsSync.mockReturnValue(false);

      await buildService();

      expect(mockedMkdirSync).toHaveBeenCalledWith(UPLOAD_DIR, { recursive: true });
    });
  });

  // ── buildFileInfo ─────────────────────────────────────────────────────────

  describe('buildFileInfo()', () => {
    beforeEach(async () => {
      service = await buildService();
    });

    it('returns url in the format /api/v1/storage/{fileId}', async () => {
      const file = makeMulterFile();

      const info = await service.buildFileInfo(file, 'tenant-001');

      expect(info.url).toMatch(/^\/api\/v1\/storage\//);
      expect(info.url).toBe(`/api/v1/storage/${info.fileId}`);
    });

    it('returned fileId is a UUID string', async () => {
      const file = makeMulterFile();

      const info = await service.buildFileInfo(file, 'tenant-001');

      expect(info.fileId).toMatch(FILE_ID_PATTERN);
    });

    it('preserves the original file extension in filename', async () => {
      const file = makeMulterFile({ originalname: 'interview.mp3' });

      const info = await service.buildFileInfo(file, 'tenant-001');

      expect(path.extname(info.filename)).toBe('.mp3');
    });

    it('preserves .wav extension for wav files', async () => {
      const file = makeMulterFile({ originalname: 'audio.wav' });

      const info = await service.buildFileInfo(file, 'tenant-001');

      expect(info.filename).toMatch(/\.wav$/);
    });

    it('transparently passes through originalname from the multer file', async () => {
      const file = makeMulterFile({ originalname: 'my-recording.m4a' });

      const info = await service.buildFileInfo(file, 'tenant-001');

      expect(info.originalname).toBe('my-recording.m4a');
    });

    it('transparently passes through size from the multer file', async () => {
      const file = makeMulterFile({ size: 512000 });

      const info = await service.buildFileInfo(file, 'tenant-001');

      expect(info.size).toBe(512000);
    });

    it('transparently passes through mimetype from the multer file', async () => {
      const file = makeMulterFile({ mimetype: 'audio/mpeg' });

      const info = await service.buildFileInfo(file, 'tenant-001');

      expect(info.mimetype).toBe('audio/mpeg');
    });

    it('calls fs.renameSync to move the file from its temp path to uploadDir', async () => {
      const file = makeMulterFile({ path: '/tmp/uploads/some-tmp-file.wav' });

      const info = await service.buildFileInfo(file, 'tenant-001');

      expect(mockedRenameSync).toHaveBeenCalledWith(
        file.path,
        path.join(UPLOAD_DIR, info.filename),
      );
    });
  });

  // ── getFilePath ───────────────────────────────────────────────────────────

  describe('getFilePath()', () => {
    beforeEach(async () => {
      service = await buildService();
    });

    it('returns the full file path when a file matching the fileId prefix is found', () => {
      const fileId = 'abc123de-0000-0000-0000-000000000001';
      const storedFilename = `${fileId}.wav`;
      mockedReaddirSync.mockReturnValue([storedFilename] as any);

      const result = service.getFilePath(fileId);

      expect(result).toBe(path.join(UPLOAD_DIR, storedFilename));
    });

    it('returns null when no file matches the fileId prefix', () => {
      mockedReaddirSync.mockReturnValue(['other-file.wav', 'another.mp3'] as any);

      const result = service.getFilePath('nonexistent-file-id');

      expect(result).toBeNull();
    });

    it('returns null when the upload directory is empty', () => {
      mockedReaddirSync.mockReturnValue([] as any);

      const result = service.getFilePath('any-file-id');

      expect(result).toBeNull();
    });

    it('reads from the configured uploadDir', () => {
      mockedReaddirSync.mockReturnValue([] as any);

      service.getFilePath('some-id');

      expect(mockedReaddirSync).toHaveBeenCalledWith(UPLOAD_DIR);
    });
  });
});
