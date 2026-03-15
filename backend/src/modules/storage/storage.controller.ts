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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as crypto from 'crypto';
import { Response } from 'express';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Storage')
@ApiBearerAuth()
@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @ApiOperation({
    summary: '上传音频文件（最大 50MB）',
    description: '支持格式: wav/mp3/mp4/m4a/aac/ogg/webm',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: '上传成功，返回文件信息' })
  @ApiResponse({ status: 400, description: '不支持的文件格式' })
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
  @ApiOperation({ summary: '获取当前租户文件列表' })
  @ApiResponse({ status: 200, description: '文件列表' })
  async listFiles(@Req() req: { user: { tenantId: string } }) {
    return this.storageService.listFiles(req.user.tenantId);
  }

  @Delete(':fileId')
  @ApiOperation({ summary: '软删除文件' })
  @ApiParam({ name: 'fileId', description: '文件 ID（UUID）' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '文件不存在' })
  async deleteFile(@Param('fileId') fileId: string, @Req() req: { user: { tenantId: string } }) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(fileId)) throw new BadRequestException('Invalid file ID');
    return this.storageService.softDeleteFile(fileId, req.user.tenantId);
  }

  @Get(':fileId')
  @ApiOperation({ summary: '下载/播放文件（流式返回）' })
  @ApiParam({ name: 'fileId', description: '文件 ID（UUID）' })
  @ApiResponse({ status: 200, description: '文件流' })
  @ApiResponse({ status: 404, description: '文件不存在' })
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
