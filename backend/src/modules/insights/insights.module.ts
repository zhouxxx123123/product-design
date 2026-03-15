import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionInsightEntity } from '../../entities/session-insight.entity';
import { TranscriptSegmentEntity } from '../../entities/transcript-segment.entity';
import { AiProxyModule } from '../ai-proxy/ai-proxy.module';
import { InsightsService } from './insights.service';
import { InsightsController } from './insights.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SessionInsightEntity, TranscriptSegmentEntity]),
    AiProxyModule,
  ],
  controllers: [InsightsController],
  providers: [InsightsService],
  exports: [InsightsService],
})
export class InsightsModule {}
