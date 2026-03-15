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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@ApiTags('Reports')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('sessions/:id/report/export')
  @ApiOperation({
    summary: '发起报告导出任务（异步）',
    description: '返回 jobId，可通过 GET /report-jobs/{jobId} 轮询状态',
  })
  @ApiParam({ name: 'id', description: '会话 ID' })
  @ApiResponse({ status: 201, description: '返回 { jobId: string }' })
  startExport(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.reportService.startExport(id, req.user.tenantId);
  }

  @Get('sessions/:id/report/download')
  @ApiOperation({ summary: '下载最新报告（HTML 格式）' })
  @ApiParam({ name: 'id', description: '会话 ID' })
  @ApiResponse({ status: 200, description: 'HTML 附件' })
  @ApiResponse({ status: 404, description: '报告尚未生成' })
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
  @ApiOperation({ summary: '直接导出报告（支持 html/excel/word）' })
  @ApiParam({ name: 'id', description: '会话 ID' })
  @ApiQuery({
    name: 'format',
    enum: ['html', 'excel', 'word'],
    required: false,
    description: '导出格式，默认 html',
  })
  @ApiResponse({ status: 200, description: '文件附件' })
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
  @ApiOperation({ summary: '查询报告导出任务列表' })
  @ApiQuery({
    name: 'sessionId',
    required: false,
    type: String,
    description: '会话 ID 过滤',
  })
  @ApiResponse({ status: 200, description: '导出任务列表' })
  async listJobs(@Req() req: RequestWithUser, @Query('sessionId') sessionId?: string) {
    return this.reportService.listJobs(req.user.tenantId, sessionId);
  }

  @Get('report-jobs/:jobId')
  @ApiOperation({ summary: '查询单个导出任务状态' })
  @ApiParam({ name: 'jobId', description: '任务 ID' })
  @ApiResponse({ status: 200, description: '任务状态' })
  @ApiResponse({ status: 404, description: '任务不存在' })
  async getJobStatus(@Param('jobId') jobId: string, @Req() req: RequestWithUser) {
    return this.reportService.getJobStatus(jobId, req.user.tenantId);
  }
}
