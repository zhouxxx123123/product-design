import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class OutlineSectionDto {
  @IsString()
  @MaxLength(50)
  id: string;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  questions: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class GenerateOutlineDto {
  @IsString()
  @MaxLength(100)
  sessionId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  clientBackground?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  researchGoals?: string[];
}

export class OptimizeOutlineDto {
  @IsString()
  @MaxLength(100)
  sessionId: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OutlineSectionDto)
  existingOutline: OutlineSectionDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}
