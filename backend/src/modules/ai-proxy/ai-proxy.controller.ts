import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { AiProxyService } from './ai-proxy.service';
import { ChatDto } from './dto/chat.dto';
import { GenerateComponentDto } from './dto/component.dto';
import { InsightProxyDto } from './dto/insight.dto';
import { GenerateOutlineDto, OptimizeOutlineDto } from './dto/outline.dto';

@ApiTags('AI Proxy')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiProxyController {
  constructor(private readonly aiProxyService: AiProxyService) {}

  @Post('llm/chat')
  @ApiOperation({
    summary: 'LLM 非流式对话',
    description: '调用 Kimi-k2.5，返回完整 JSON 响应',
  })
  @ApiResponse({ status: 200, description: '对话响应' })
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async chat(@Body() dto: ChatDto): Promise<unknown> {
    return this.aiProxyService.chat(dto);
  }

  @Post('llm/chat/stream')
  @ApiOperation({
    summary: 'LLM 流式对话（SSE）',
    description: '返回 text/event-stream，每个 chunk 含 delta 字段',
  })
  @ApiResponse({ status: 200, description: 'SSE 流' })
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async chatStream(@Body() dto: ChatDto, @Res() res: Response): Promise<void> {
    await this.aiProxyService.chatStream(dto, res);
  }

  @Post('llm/chat/copilot/stream')
  @ApiOperation({
    summary: 'Copilot 增强流式对话（含 tool_call 事件）',
    description: '用于工作台 Copilot 侧边栏，支持 action/tool_call 事件类型',
  })
  @ApiResponse({ status: 200, description: 'SSE 流' })
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async copilotChatStream(@Body() dto: ChatDto, @Res() res: Response): Promise<void> {
    await this.aiProxyService.copilotChatStream(dto, res);
  }

  @Post('insight/extract')
  @ApiOperation({
    summary: 'AI 提取访谈洞察',
    description: '从转录文本提取主题（Layer2）、引用（Layer1）、情感（Layer3）',
  })
  @ApiResponse({ status: 200, description: '洞察提取结果' })
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async extractInsight(@Body() dto: InsightProxyDto): Promise<unknown> {
    return this.aiProxyService.extractInsight(dto);
  }

  @Post('outline/generate')
  @ApiOperation({
    summary: 'AI 生成访谈提纲',
    description: '根据会话 title + 研究目标生成结构化提纲',
  })
  @ApiResponse({ status: 200, description: '生成的访谈提纲' })
  @ApiResponse({ status: 404, description: 'Session 不存在' })
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async generateOutline(
    @Body() dto: GenerateOutlineDto,
    @Req() req: Request & { user: JwtUser },
  ): Promise<unknown> {
    return this.aiProxyService.generateOutline(dto, req.user.tenantId);
  }

  @Post('outline/optimize')
  @ApiOperation({ summary: 'AI 优化访谈提纲章节' })
  @ApiResponse({ status: 200, description: '优化后的提纲章节' })
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async optimizeOutline(@Body() dto: OptimizeOutlineDto): Promise<unknown> {
    return this.aiProxyService.optimizeOutline(dto);
  }

  @Post('component/generate')
  @ApiOperation({
    summary: 'AI 生成 UI 组件 Schema（Copilot 动态卡片）',
  })
  @ApiResponse({ status: 200, description: '生成的组件 Schema' })
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async generateComponent(@Body() dto: GenerateComponentDto): Promise<unknown> {
    return this.aiProxyService.generateComponent(dto);
  }

  @Post('asr/recognize')
  @ApiOperation({
    summary: '音频文件语音识别（ASR）',
    description: '上传音频文件，返回转录文本和时间戳段落',
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
  @ApiResponse({ status: 200, description: '识别结果' })
  @ApiResponse({ status: 400, description: '不支持的音频格式' })
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
