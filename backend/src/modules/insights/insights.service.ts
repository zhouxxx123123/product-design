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
    })) as Record<string, unknown>;

    // 4. Map AI response { themes, key_quotes, sentiment, summary } → layer 1/2/3 insights
    // Layer 1 = key quotes (直接引用)
    // Layer 2 = themes (主题)
    // Layer 3 = summary + sentiment (战略洞察)
    const normalizedInsights: Array<{ layer: number; content: Record<string, unknown> }> = [];

    const themes = Array.isArray(aiResult['themes'])
      ? (aiResult['themes'] as Record<string, unknown>[])
      : [];
    const keyQuotes = Array.isArray(aiResult['key_quotes'])
      ? (aiResult['key_quotes'] as Record<string, unknown>[])
      : [];
    const sentiment = aiResult['sentiment'] as Record<string, unknown> | undefined;
    const summary = typeof aiResult['summary'] === 'string' ? aiResult['summary'] : '';

    // Layer 1: key quotes
    for (const quote of keyQuotes) {
      normalizedInsights.push({
        layer: 1,
        content: {
          title: typeof quote['insight'] === 'string' ? quote['insight'] : '关键引用',
          text: typeof quote['text'] === 'string' ? quote['text'] : '',
          speaker: typeof quote['speaker'] === 'string' ? quote['speaker'] : '',
        },
      });
    }

    // Layer 2: themes
    for (const theme of themes) {
      normalizedInsights.push({
        layer: 2,
        content: {
          title: typeof theme['title'] === 'string' ? theme['title'] : '主题',
          text: typeof theme['description'] === 'string' ? theme['description'] : '',
          evidence: Array.isArray(theme['evidence']) ? theme['evidence'] : [],
        },
      });
    }

    // Layer 3: summary + sentiment (one record)
    if (summary || sentiment) {
      normalizedInsights.push({
        layer: 3,
        content: {
          title: '战略摘要',
          text: summary,
          sentiment: sentiment ?? {},
        },
      });
    }

    // 5. Delete existing AI-generated insights for this session to avoid duplicates
    await this.repo.delete({ sessionId, tenantId });

    // 6. Save new insights
    const toSave = normalizedInsights.map((item) =>
      this.repo.create({
        sessionId,
        tenantId,
        editedBy: userId,
        layer: item.layer,
        content: item.content,
      }),
    );

    return this.repo.save(toSave);
  }
}
