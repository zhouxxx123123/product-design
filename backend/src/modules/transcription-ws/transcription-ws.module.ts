import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TranscriptSegmentEntity } from '../../entities/transcript-segment.entity';
import { TranscriptionEntity } from '../../entities/transcription.entity';
import { TranscriptionGateway } from './transcription.gateway';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([TranscriptSegmentEntity, TranscriptionEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => ({
        secret: cs.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [TranscriptionGateway],
})
export class TranscriptionWsModule {}
