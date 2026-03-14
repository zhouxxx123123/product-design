import { IsString, IsOptional, IsDateString, IsInt, Min } from 'class-validator';
import { InterviewSessionEntity } from '../../../entities/interview-session.entity';

export class UpdateSessionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  interviewerId?: string;

  @IsOptional()
  @IsDateString()
  interviewDate?: string | Date;

  @IsOptional()
  @IsInt()
  @Min(1)
  plannedDurationMinutes?: number;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  rawTranscript?: string;

  @IsOptional()
  structuredSummary?: InterviewSessionEntity['structuredSummary'];

  @IsOptional()
  executiveSummary?: InterviewSessionEntity['executiveSummary'];
}
