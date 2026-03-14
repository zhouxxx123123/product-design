import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AiProxyController } from './ai-proxy.controller';
import { AiProxyService } from './ai-proxy.service';
import { CopilotComponentTemplateEntity } from '../../entities/copilot-component-template.entity';
import { InterviewSessionEntity } from '../../entities/interview-session.entity';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    AuthModule,
    TypeOrmModule.forFeature([InterviewSessionEntity, CopilotComponentTemplateEntity]),
  ],
  controllers: [AiProxyController],
  providers: [AiProxyService],
  exports: [AiProxyService],
})
export class AiProxyModule {}
