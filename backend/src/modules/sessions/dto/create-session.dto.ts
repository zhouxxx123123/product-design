import { IsString, IsNotEmpty, IsOptional, IsDateString, IsInt, Min } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  interviewerId?: string;

  @IsDateString()
  interviewDate: string | Date;

  @IsOptional()
  @IsInt()
  @Min(1)
  plannedDurationMinutes?: number;

  @IsOptional()
  @IsString()
  language?: string;
}
