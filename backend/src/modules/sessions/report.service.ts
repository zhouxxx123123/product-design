import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InterviewSessionEntity } from '../../entities/interview-session.entity';
import { ReportJobEntity, ReportJobStatus } from '../../entities/report-job.entity';
import * as ExcelJS from 'exceljs';
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(InterviewSessionEntity)
    private readonly sessionsRepo: Repository<InterviewSessionEntity>,
    @InjectRepository(ReportJobEntity)
    private readonly reportJobRepo: Repository<ReportJobEntity>,
  ) {}

  async startExport(sessionId: string, tenantId: string): Promise<{ jobId: string }> {
    // Load session first to verify it exists
    await this.loadSession(sessionId, tenantId);

    // Create DB record with status=PROCESSING
    const reportJob = this.reportJobRepo.create({
      tenantId,
      sessionId,
      status: ReportJobStatus.PROCESSING,
      format: 'html',
      filePath: null,
      error: null,
    });

    const savedJob = await this.reportJobRepo.save(reportJob);

    try {
      // Update status=DONE, filePath=jobId (store jobId as filePath since HTML is reconstructed)
      savedJob.status = ReportJobStatus.DONE;
      savedJob.filePath = savedJob.id;
      await this.reportJobRepo.save(savedJob);

      return { jobId: savedJob.id };
    } catch (error) {
      // On error: update record status=FAILED, error=message, re-throw
      savedJob.status = ReportJobStatus.FAILED;
      savedJob.error = error instanceof Error ? error.message : String(error);
      await this.reportJobRepo.save(savedJob);
      throw error;
    }
  }

  async getJob(jobId: string): Promise<ReportJobEntity | null> {
    return this.reportJobRepo.findOne({ where: { id: jobId } });
  }

  async getJobsBySession(sessionId: string): Promise<ReportJobEntity[]> {
    return this.reportJobRepo.find({
      where: { sessionId },
      order: { createdAt: 'DESC' },
    });
  }

  async getJobStatus(jobId: string, tenantId: string): Promise<ReportJobEntity> {
    const job = await this.reportJobRepo.findOne({
      where: { id: jobId, tenantId },
    });
    if (!job) {
      throw new NotFoundException(`Report job ${jobId} not found`);
    }
    return job;
  }

  async listJobs(tenantId: string, sessionId?: string): Promise<ReportJobEntity[]> {
    const whereConditions = { tenantId, ...(sessionId ? { sessionId } : {}) };
    return this.reportJobRepo.find({
      where: whereConditions,
      order: { createdAt: 'DESC' },
    });
  }

  // ── New: direct export methods ─────────────────────────────────────────────

  async exportToHtml(sessionId: string, tenantId: string): Promise<string> {
    const session = await this.loadSession(sessionId, tenantId);
    return this.buildHtml(session);
  }

  async exportToExcel(sessionId: string, tenantId: string): Promise<Buffer> {
    const session = await this.loadSession(sessionId, tenantId);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('调研报告');

    ws.columns = [
      { header: '字段', key: 'label', width: 20 },
      { header: '内容', key: 'value', width: 80 },
    ];

    const rows: Array<[string, string]> = [
      ['标题', session.title],
      ['状态', session.status],
      ['访谈日期', session.interviewDate?.toISOString().slice(0, 10) ?? '未设置'],
      ['描述', session.description ?? ''],
      ['语言', session.language ?? ''],
      ['计划时长(分钟)', String(session.plannedDurationMinutes ?? '')],
      ['开始时间', session.startedAt?.toISOString() ?? ''],
      ['完成时间', session.completedAt?.toISOString() ?? ''],
      ['原始转写', session.rawTranscript ?? '（暂无）'],
      ['结构化摘要', JSON.stringify(session.structuredSummary ?? {}, null, 2)],
      ['执行摘要', JSON.stringify(session.executiveSummary ?? {}, null, 2)],
    ];

    rows.forEach(([label, value]) => ws.addRow({ label, value }));

    // Style header row
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportToWord(sessionId: string, tenantId: string): Promise<Buffer> {
    const session = await this.loadSession(sessionId, tenantId);
    const interviewDate = session.interviewDate?.toISOString().slice(0, 10) ?? '未设置';

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: session.title,
              heading: HeadingLevel.TITLE,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `状态: ${session.status}  |  访谈日期: ${interviewDate}`,
                  color: '64748B',
                }),
              ],
            }),
            new Paragraph({ text: '' }),

            new Paragraph({ text: '原始转写', heading: HeadingLevel.HEADING_1 }),
            new Paragraph({
              children: [new TextRun({ text: session.rawTranscript ?? '（暂无转写内容）' })],
            }),
            new Paragraph({ text: '' }),

            new Paragraph({ text: '结构化摘要', heading: HeadingLevel.HEADING_1 }),
            new Paragraph({
              children: [
                new TextRun({
                  text: JSON.stringify(session.structuredSummary ?? {}, null, 2),
                  font: 'Courier New',
                }),
              ],
            }),
            new Paragraph({ text: '' }),

            new Paragraph({ text: '执行摘要', heading: HeadingLevel.HEADING_1 }),
            ...(session.executiveSummary?.keyFindings?.map(
              (f) =>
                new Paragraph({
                  children: [
                    new TextRun({ text: `[${f.priority.toUpperCase()}] `, bold: true }),
                    new TextRun({ text: f.finding }),
                  ],
                }),
            ) ?? [
              new Paragraph({
                children: [
                  new TextRun({ text: session.executiveSummary?.overview ?? '（暂无执行摘要）' }),
                ],
              }),
            ]),
          ],
        },
      ],
    });

    return Packer.toBuffer(doc);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private static escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private async loadSession(sessionId: string, tenantId: string): Promise<InterviewSessionEntity> {
    const session = await this.sessionsRepo.findOne({
      where: { id: sessionId, tenantId } as never,
    });
    if (!session) throw new NotFoundException(`会话 ${sessionId} 不存在`);
    return session;
  }

  private buildHtml(session: InterviewSessionEntity): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>${ReportService.escapeHtml(session.title ?? '')} - 调研报告</title>
<style>
  body { font-family: sans-serif; padding: 40px; color: #1e293b; }
  h1 { font-size: 28px; margin-bottom: 8px; }
  .meta { color: #64748b; font-size: 14px; margin-bottom: 32px; }
  section { margin-bottom: 24px; }
  h2 { font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
  pre { background: #f8fafc; padding: 16px; border-radius: 8px; white-space: pre-wrap; }
</style>
</head>
<body>
  <h1>${ReportService.escapeHtml(session.title ?? '')}</h1>
  <p class="meta">状态: ${ReportService.escapeHtml(session.status ?? '')} | 访谈日期: ${ReportService.escapeHtml(session.interviewDate?.toISOString().slice(0, 10) ?? '未设置')}</p>
  <section>
    <h2>原始转写</h2>
    <pre>${ReportService.escapeHtml(session.rawTranscript ?? '（暂无转写内容）')}</pre>
  </section>
  <section>
    <h2>结构化摘要</h2>
    <pre>${ReportService.escapeHtml(JSON.stringify(session.structuredSummary ?? {}, null, 2))}</pre>
  </section>
  <section>
    <h2>执行摘要</h2>
    <pre>${ReportService.escapeHtml(JSON.stringify(session.executiveSummary ?? {}, null, 2))}</pre>
  </section>
</body>
</html>`;
  }
}
