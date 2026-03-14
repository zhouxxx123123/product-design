import { IsInt, IsNotEmpty, IsObject, Min, Max } from 'class-validator';

export class CreateInsightDto {
  @IsInt()
  @Min(1, { message: 'layer 最小值为 1' })
  @Max(3, { message: 'layer 最大值为 3（三层洞察）' })
  layer: number;

  @IsObject()
  @IsNotEmpty({ message: 'content 不能为空对象' })
  content: Record<string, unknown>;
}

export class UpdateInsightDto {
  @IsObject()
  @IsNotEmpty()
  content?: Record<string, unknown>;
}
