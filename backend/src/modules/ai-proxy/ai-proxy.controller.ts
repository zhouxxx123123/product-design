import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiProxyService } from './ai-proxy.service';
import { ChatDto } from './dto/chat.dto';
import { GenerateComponentDto } from './dto/component.dto';
import { InsightProxyDto } from './dto/insight.dto';
import { GenerateOutlineDto, OptimizeOutlineDto } from './dto/outline.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiProxyController {
  constructor(private readonly aiProxyService: AiProxyService) {}

  @Post('llm/chat')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async chat(@Body() dto: ChatDto): Promise<unknown> {
    return this.aiProxyService.chat(dto);
  }

  @Post('llm/chat/stream')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async chatStream(@Body() dto: ChatDto, @Res() res: Response): Promise<void> {
    await this.aiProxyService.chatStream(dto, res);
  }

  @Post('llm/chat/copilot/stream')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async copilotChatStream(@Body() dto: ChatDto, @Res() res: Response): Promise<void> {
    await this.aiProxyService.copilotChatStream(dto, res);
  }

  @Post('insight/extract')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async extractInsight(@Body() dto: InsightProxyDto): Promise<unknown> {
    return this.aiProxyService.extractInsight(dto);
  }

  @Post('outline/generate')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async generateOutline(@Body() dto: GenerateOutlineDto): Promise<unknown> {
    return this.aiProxyService.generateOutline(dto);
  }

  @Post('outline/optimize')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async optimizeOutline(@Body() dto: OptimizeOutlineDto): Promise<unknown> {
    return this.aiProxyService.optimizeOutline(dto);
  }

  @Post('component/generate')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async generateComponent(@Body() dto: GenerateComponentDto): Promise<unknown> {
    return this.aiProxyService.generateComponent(dto);
  }

  @Post('asr/recognize')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
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
  async recognizeAudio(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ): Promise<unknown> {
    return this.aiProxyService.recognizeAudio(file);
  }
}
