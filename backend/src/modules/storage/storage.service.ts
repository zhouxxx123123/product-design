import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { StorageFileEntity } from '../../entities/storage-file.entity';

export interface UploadedFileInfo {
  fileId: string;
  url: string;
  filename: string;
  originalname: string;
  size: number;
  mimetype: string;
}

@Injectable()
export class StorageService {
  readonly uploadDir: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(StorageFileEntity)
    private readonly storageFileRepository: Repository<StorageFileEntity>,
  ) {
    this.uploadDir = config.get<string>('UPLOAD_DIR', './uploads') as string;
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async buildFileInfo(
    file: Express.Multer.File,
    tenantId: string,
    uploaderId?: string,
    expiresAt?: Date,
  ): Promise<UploadedFileInfo> {
    const fileId = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    const filename = `${fileId}${ext}`;
    const destPath = path.join(this.uploadDir, filename);
    fs.renameSync(file.path, destPath);

    // Insert DB record
    await this.storageFileRepository.insert({
      tenantId,
      fileId,
      filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/api/v1/storage/${fileId}`,
      uploaderId: uploaderId ?? null,
      expiresAt: expiresAt ?? null,
    });

    return {
      fileId,
      url: `/api/v1/storage/${fileId}`,
      filename,
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  async listFiles(tenantId: string): Promise<StorageFileEntity[]> {
    return this.storageFileRepository.find({
      where: {
        tenantId,
        deletedAt: IsNull(),
        isExpired: false,
      },
    });
  }

  async softDeleteFile(fileId: string, tenantId: string): Promise<{ success: boolean }> {
    const result = await this.storageFileRepository.softDelete({
      fileId,
      tenantId,
    });
    return { success: (result.affected ?? 0) > 0 };
  }

  async markExpired(): Promise<number> {
    const result = await this.storageFileRepository.update(
      {
        expiresAt: LessThan(new Date()),
        isExpired: false,
      },
      {
        isExpired: true,
      },
    );
    return result.affected ?? 0;
  }

  getFilePath(fileId: string): string | null {
    const files = fs.readdirSync(this.uploadDir);
    const match = files.find((f) => f.startsWith(fileId));
    if (!match) return null;
    return path.join(this.uploadDir, match); // return full path
  }
}
