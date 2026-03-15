import { IsInt, IsNotEmpty, IsObject, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInsightDto {
  @ApiProperty({
    type: 'integer',
    example: 1,
    description: `洞察层级（1-3）：
- **1 = 关键引用**：原话直接引用，结构 { title: string, text: string, speaker: string }
- **2 = 主题归纳**：多条引用归纳为主题，结构 { title: string, text: string, evidence: string[] }
- **3 = 战略摘要**：高层战略洞察，结构 { title: string, text: string, sentiment: 'positive'|'neutral'|'negative' }`,
    minimum: 1,
    maximum: 3,
  })
  @IsInt()
  @Min(1, { message: 'layer 最小值为 1' })
  @Max(3, { message: 'layer 最大值为 3（三层洞察）' })
  layer: number;

  @ApiProperty({
    description: `洞察内容（jsonb），结构随 layer 不同：
- layer=1（关键引用）: \`{ "title": "用户痛点", "text": "流程太繁琐", "speaker": "受访者 A" }\`
- layer=2（主题归纳）: \`{ "title": "操作复杂", "text": "多位用户提到流程繁琐", "evidence": ["流程太繁琐", "步骤太多"] }\`
- layer=3（战略摘要）: \`{ "title": "体验改进机会", "text": "简化核心操作路径可显著提升留存", "sentiment": "negative" }\``,
    oneOf: [
      {
        title: 'Layer 1 — 关键引用',
        example: { title: '用户痛点', text: '流程太繁琐', speaker: '受访者 A' },
      },
      {
        title: 'Layer 2 — 主题归纳',
        example: {
          title: '操作复杂',
          text: '多位用户提到流程繁琐',
          evidence: ['流程太繁琐', '步骤太多'],
        },
      },
      {
        title: 'Layer 3 — 战略摘要',
        example: {
          title: '体验改进机会',
          text: '简化核心操作路径可显著提升留存',
          sentiment: 'negative',
        },
      },
    ],
  })
  @IsObject()
  @IsNotEmpty({ message: 'content 不能为空对象' })
  content: Record<string, unknown>;
}

export class UpdateInsightDto {
  @ApiPropertyOptional({
    description: '更新洞察内容（jsonb），结构与 CreateInsightDto.content 相同，随 layer 类型变化',
    example: { title: '用户痛点（已修改）', text: '补充更多细节', speaker: '受访者 B' },
  })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;
}
