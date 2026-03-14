import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('sessions/:id/report/export')
  startExport(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.reportService.startExport(id, req.user.tenantId);
  }

  @Get('sessions/:id/report/download')
  async download(@Param('id') id: string, @Req() req: RequestWithUser, @Res() res: Response) {
    const jobs = await this.reportService.getJobsBySession(id);
    const job = jobs[0]; // Already sorted by createdAt DESC

    if (!job) throw new NotFoundException('报告尚未生成，请先调用 POST /report/export');

    // For now, rebuild HTML on demand since we only store jobId as filePath
    const html = await this.reportService.exportToHtml(id, req.user.tenantId);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="report-${id}.html"`);
    res.send(html);
  }

  /**
   * GET /sessions/:id/export?format=html|excel|word
   * 直接导出，无需预先生成 job
   */
  @Get('sessions/:id/export')
  async exportReport(
    @Param('id') id: string,
    @Query('format') format: string = 'html',
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    const tenantId = req.user.tenantId;

    if (format === 'excel') {
      const buffer = await this.reportService.exportToExcel(id, tenantId);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="report-${id}.xlsx"`);
      res.end(buffer);
      return;
    }

    if (format === 'word') {
      const buffer = await this.reportService.exportToWord(id, tenantId);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      res.setHeader('Content-Disposition', `attachment; filename="report-${id}.docx"`);
      res.end(buffer);
      return;
    }

    // default: html
    const html = await this.reportService.exportToHtml(id, tenantId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="report-${id}.html"`);
    res.send(html);
  }

  @Get('report-jobs')
  async listJobs(@Req() req: RequestWithUser, @Query('sessionId') sessionId?: string) {
    return this.reportService.listJobs(req.user.tenantId, sessionId);
  }

  @Get('report-jobs/:jobId')
  async getJobStatus(@Param('jobId') jobId: string, @Req() req: RequestWithUser) {
    return this.reportService.getJobStatus(jobId, req.user.tenantId);
  }
}
