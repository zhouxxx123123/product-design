import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionInsightEntity } from '../../entities/session-insight.entity';
import { TranscriptSegmentEntity } from '../../entities/transcript-segment.entity';
import { CreateInsightDto, UpdateInsightDto } from './insights.dto';
import { AiProxyService } from '../ai-proxy/ai-proxy.service';

export { CreateInsightDto, UpdateInsightDto } from './insights.dto';

@Injectable()
export class InsightsService {
  constructor(
    @InjectRepository(SessionInsightEntity)
    private readonly repo: Repository<SessionInsightEntity>,
    @InjectRepository(TranscriptSegmentEntity)
    private readonly transcriptRepo: Repository<TranscriptSegmentEntity>,
    private readonly aiProxyService: AiProxyService,
  ) {}

  async findBySession(sessionId: string, tenantId: string): Promise<SessionInsightEntity[]> {
    return this.repo.find({
      where: { sessionId, tenantId },
      order: { layer: 'ASC' },
    });
  }

  async create(
    sessionId: string,
    tenantId: string,
    userId: string,
    dto: CreateInsightDto,
  ): Promise<SessionInsightEntity> {
    const insight = this.repo.create({
      sessionId,
      tenantId,
      editedBy: userId,
      layer: dto.layer,
      content: dto.content,
    });
    return this.repo.save(insight);
  }

  async update(
    id: string,
    tenantId: string,
    userId: string,
    dto: UpdateInsightDto,
  ): Promise<SessionInsightEntity> {
    const insight = await this.repo.findOne({ where: { id, tenantId } });
    if (!insight) throw new NotFoundException(`洞察 ${id} 不存在`);
    if (dto.content !== undefined) insight.content = dto.content;
    insight.editedBy = userId;
    return this.repo.save(insight);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const insight = await this.repo.findOne({ where: { id, tenantId } });
    if (!insight) throw new NotFoundException(`洞察 ${id} 不存在`);
    await this.repo.remove(insight);
  }

  async extractFromSession(
    sessionId: string,
    tenantId: string,
    userId: string,
  ): Promise<SessionInsightEntity[]> {
    // 1. Load transcript segments
    const segments = await this.transcriptRepo.find({
      where: { sessionId, tenantId },
      order: { startMs: 'ASC' },
    });

    if (segments.length === 0) {
      throw new BadRequestException('该调研暂无转写记录，无法提取洞察');
    }

    // 2. Build transcript string
    const transcript = segments.map((s) => `[${s.speaker ?? '未知'}]: ${s.text}`).join('\n');

    // 3. Call AI service
    const aiResult = (await this.aiProxyService.extractInsight({
      transcript,
      interview_id: sessionId,
    })) as unknown;

    // 4. Normalize AI response
    const rawInsights = Array.isArray(aiResult) ? aiResult : [];

    // 5. Delete existing AI-generated insights for this session (layer 1-3)
    // to avoid duplicates on re-extraction
    await this.repo.delete({ sessionId, tenantId });

    // 6. Save new insights
    const toSave = rawInsights
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) =>
        this.repo.create({
          sessionId,
          tenantId,
          editedBy: userId,
          layer: typeof item['layer'] === 'number' ? item['layer'] : 1,
          content:
            typeof item['content'] === 'object' && item['content'] !== null
              ? (item['content'] as Record<string, unknown>)
              : { text: String(item['content'] ?? '') },
        }),
      );

    return this.repo.save(toSave);
  }
}
