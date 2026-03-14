import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterviewSessionEntity } from '../../entities/interview-session.entity';
import { TemplateEntity } from '../../entities/template.entity';
import { SessionCommentEntity } from '../../entities/session-comment.entity';
import { SessionCaseLinkEntity } from '../../entities/session-case-link.entity';
import { TranscriptSegmentEntity } from '../../entities/transcript-segment.entity';
import { ReportJobEntity } from '../../entities/report-job.entity';
import { StorageFileEntity } from '../../entities/storage-file.entity';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { TranscriptService } from './transcript.service';
import { TranscriptController } from './transcript.controller';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InterviewSessionEntity,
      TemplateEntity,
      SessionCommentEntity,
      SessionCaseLinkEntity,
      TranscriptSegmentEntity,
      ReportJobEntity,
      StorageFileEntity,
    ]),
  ],
  controllers: [SessionsController, TemplatesController, TranscriptController, ReportController],
  providers: [SessionsService, TemplatesService, TranscriptService, ReportService],
  exports: [SessionsService, TemplatesService, TranscriptService, ReportService],
})
export class SessionsModule {}
