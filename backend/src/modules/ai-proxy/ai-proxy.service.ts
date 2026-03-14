import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { ChatDto } from './dto/chat.dto';
import { GenerateComponentDto } from './dto/component.dto';
import { InsightProxyDto } from './dto/insight.dto';
import { GenerateOutlineDto, OptimizeOutlineDto } from './dto/outline.dto';
import { CopilotComponentTemplateEntity } from '../../entities/copilot-component-template.entity';
import { InterviewSessionEntity } from '../../entities/interview-session.entity';

@Injectable()
export class AiProxyService {
  private readonly logger = new Logger(AiProxyService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(InterviewSessionEntity)
    private readonly sessionRepo: Repository<InterviewSessionEntity>,
    @InjectRepository(CopilotComponentTemplateEntity)
    private readonly componentTemplateRepo: Repository<CopilotComponentTemplateEntity>,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL', 'http://localhost:8000');
  }

  private static async withRetry<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    logger?: Logger,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastError = err;
        const status = (err as { response?: { status?: number } })?.response?.status;
        // Don't retry 4xx errors (client errors)
        if (status !== undefined && status >= 400 && status < 500) throw err;
        if (attempt < maxAttempts) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          logger?.warn(
            `AI request attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms`,
          );
          await new Promise<void>((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }

  async chat(dto: ChatDto): Promise<unknown> {
    const url = `${this.aiServiceUrl}/api/v1/llm/chat`;
    this.logger.debug(`Forwarding non-stream chat request to ${url}`);

    return AiProxyService.withRetry(
      () =>
        firstValueFrom(
          this.httpService.post(url, dto, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 120_000,
          }),
        ).then((r) => r.data),
      3,
      this.logger,
    ).catch((error: unknown) => {
      this.logger.error('Non-stream chat request failed after retries', error);
      throw new InternalServerErrorException(
        'AI service temporarily unavailable. Please try again.',
      );
    });
  }

  async chatStream(dto: ChatDto, res: Response): Promise<void> {
    const url = `${this.aiServiceUrl}/api/v1/llm/chat/stream`;
    this.logger.debug(`Forwarding stream chat request to ${url}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Connection', 'keep-alive');

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          { ...dto, stream: true },
          {
            headers: { 'Content-Type': 'application/json' },
            responseType: 'stream',
            timeout: 300_000,
          },
        ),
      );

      const stream = response.data as NodeJS.ReadableStream & { destroy(): void };

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          res.write(chunk);
        });

        stream.on('end', () => {
          res.end();
          resolve();
        });

        stream.on('error', (err: Error) => {
          this.logger.error('Stream error from AI service', err);
          if (!res.headersSent) {
            res.status(502).end();
          } else {
            res.end();
          }
          reject(err);
        });

        res.on('close', () => {
          this.logger.debug('Client disconnected, destroying upstream stream');
          stream.destroy();
          resolve();
        });
      });
    } catch (error: unknown) {
      this.logger.error('Stream chat request failed to connect', error);
      if (!res.headersSent) {
        res.status(502).json({ message: 'AI service unavailable.' });
      } else {
        res.end();
      }
    }
  }

  async copilotChatStream(dto: ChatDto, res: Response): Promise<void> {
    const url = `${this.aiServiceUrl}/api/v1/llm/chat/copilot/stream`;
    this.logger.debug(`Forwarding copilot stream request to ${url}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Connection', 'keep-alive');

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          { ...dto, stream: true },
          {
            headers: { 'Content-Type': 'application/json' },
            responseType: 'stream',
            timeout: 300_000,
          },
        ),
      );

      const stream = response.data as NodeJS.ReadableStream & { destroy(): void };

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          res.write(chunk);
        });

        stream.on('end', () => {
          res.end();
          resolve();
        });

        stream.on('error', (err: Error) => {
          this.logger.error('Copilot stream error from AI service', err);
          if (!res.headersSent) {
            res.status(502).end();
          } else {
            res.end();
          }
          reject(err);
        });

        res.on('close', () => {
          this.logger.debug('Copilot client disconnected, destroying upstream stream');
          stream.destroy();
          resolve();
        });
      });
    } catch (error: unknown) {
      this.logger.error('Copilot stream request failed to connect', error);
      if (!res.headersSent) {
        res.status(502).json({ message: 'AI copilot service unavailable.' });
      } else {
        res.end();
      }
    }
  }

  async extractInsight(dto: InsightProxyDto): Promise<unknown> {
    const url = `${this.aiServiceUrl}/api/v1/insight/extract`;
    this.logger.debug(`Forwarding insight extraction request to ${url}`);

    return AiProxyService.withRetry(
      () =>
        firstValueFrom(
          this.httpService.post(url, dto, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 120_000,
          }),
        ).then((r) => r.data),
      3,
      this.logger,
    ).catch((error: unknown) => {
      this.logger.error('Insight extraction request failed after retries', error);
      throw new InternalServerErrorException(
        'AI insight service temporarily unavailable. Please try again.',
      );
    });
  }

  async generateOutline(dto: GenerateOutlineDto): Promise<unknown> {
    const url = `${this.aiServiceUrl}/api/v1/outline/generate`;
    this.logger.debug(`Forwarding outline generation request to ${url}`);

    // 查询 session 获取 title 作为 topic
    const session = await this.sessionRepo.findOne({ where: { id: dto.sessionId } });
    if (!session) {
      throw new NotFoundException(`Session ${dto.sessionId} not found`);
    }

    // 字段映射：BackEnd DTO → AI 服务 OutlineRequest
    const aiPayload = {
      topic: session.title,
      research_goals: dto.researchGoals?.join('；') ?? dto.clientBackground ?? undefined,
      target_users: dto.clientBackground ?? undefined,
      num_questions: 10,
    };

    return AiProxyService.withRetry(
      () =>
        firstValueFrom(
          this.httpService.post(url, aiPayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 120_000,
          }),
        ).then((r) => r.data),
      3,
      this.logger,
    ).catch((error: unknown) => {
      this.logger.error('Outline generation request failed after retries', error);
      throw new InternalServerErrorException(
        'Outline generation service temporarily unavailable. Please try again.',
      );
    });
  }

  async optimizeOutline(dto: OptimizeOutlineDto): Promise<unknown> {
    const url = `${this.aiServiceUrl}/api/v1/outline/optimize`;
    this.logger.debug(`Forwarding outline optimization request to ${url}`);

    return AiProxyService.withRetry(
      () =>
        firstValueFrom(
          this.httpService.post(url, dto, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 120_000,
          }),
        ).then((r) => r.data),
      3,
      this.logger,
    ).catch((error: unknown) => {
      this.logger.error('Outline optimization request failed after retries', error);
      throw new InternalServerErrorException(
        'Outline optimization service temporarily unavailable. Please try again.',
      );
    });
  }

  async generateComponent(dto: GenerateComponentDto): Promise<unknown> {
    const url = `${this.aiServiceUrl}/api/v1/component/generate`;
    this.logger.debug(`Forwarding component generation request to ${url}`);

    return AiProxyService.withRetry(
      () =>
        firstValueFrom(
          this.httpService.post(url, dto, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 60_000,
          }),
        ).then((r) => r.data),
      3,
      this.logger,
    ).catch((error: unknown) => {
      this.logger.error('Component generation request failed after retries', error);
      throw new InternalServerErrorException('Component generation service unavailable.');
    });
  }

  async saveComponentTemplate(
    tenantId: string,
    dto: GenerateComponentDto,
    schema: Record<string, unknown>,
  ): Promise<void> {
    try {
      const template = this.componentTemplateRepo.create({
        tenantId,
        name: dto.description.slice(0, 100),
        description: dto.description,
        schema,
      });
      await this.componentTemplateRepo.save(template);
    } catch (error: unknown) {
      this.logger.error('Failed to save component template (non-critical)', error);
    }
  }

  async recognizeAudio(file: Express.Multer.File): Promise<unknown> {
    const url = `${this.aiServiceUrl}/api/v1/asr/recognize/file`;
    this.logger.debug(`Forwarding ASR multipart file to ${url}`, {
      filename: file?.originalname,
      size: file?.size,
    });

    if (!file) {
      throw new InternalServerErrorException('No audio file provided.');
    }

    // Build multipart/form-data to forward to Python AI service
    const { default: FormData } = await import('form-data');
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, form, {
          headers: form.getHeaders(),
          timeout: 300_000,
          maxContentLength: 50 * 1024 * 1024, // 50MB
          maxBodyLength: 50 * 1024 * 1024, // 50MB
        }),
      );
      return response.data;
    } catch (error: unknown) {
      this.logger.error('ASR recognition request failed', error);
      throw new InternalServerErrorException('ASR service request failed. Please try again later.');
    }
  }
}
