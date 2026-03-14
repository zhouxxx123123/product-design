import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  Req,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as crypto from 'crypto';
import { Response } from 'express';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = process.env['UPLOAD_DIR'] ?? './uploads';
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const id = crypto.randomUUID();
          const ext = path.extname(file.originalname);
          cb(null, `tmp_${id}${ext}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
      fileFilter: (_req, file, cb) => {
        const allowedMimes = [
          'audio/wav',
          'audio/wave',
          'audio/mpeg',
          'audio/mp4',
          'audio/x-m4a',
          'audio/aac',
          'audio/ogg',
          'audio/webm',
        ];
        cb(null, allowedMimes.includes(file.mimetype));
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user: { tenantId: string; sub: string } },
  ) {
    return this.storageService.buildFileInfo(file, req.user.tenantId, req.user.sub);
  }

  @Get()
  async listFiles(@Req() req: { user: { tenantId: string } }) {
    return this.storageService.listFiles(req.user.tenantId);
  }

  @Delete(':fileId')
  async deleteFile(@Param('fileId') fileId: string, @Req() req: { user: { tenantId: string } }) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(fileId)) throw new BadRequestException('Invalid file ID');
    return this.storageService.softDeleteFile(fileId, req.user.tenantId);
  }

  @Get(':fileId')
  async download(
    @Param('fileId') fileId: string,
    @Req() req: { user: { tenantId: string } },
    @Res() res: Response,
  ) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(fileId)) {
      throw new BadRequestException('Invalid file ID');
    }

    // Verify the file exists and belongs to the requesting user's tenant
    const fileRecord = await this.storageService.findFileById(fileId, req.user.tenantId);
    if (!fileRecord) {
      throw new NotFoundException(`文件 ${fileId} 不存在`);
    }

    const filename = this.storageService.getFilePath(fileId);
    if (!filename) {
      throw new NotFoundException(`文件 ${fileId} 不存在`);
    }
    res.sendFile(filename, { root: this.storageService.uploadDir });
  }
}
