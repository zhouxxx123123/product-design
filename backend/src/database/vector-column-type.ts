import { ValueTransformer } from 'typeorm';

/**
 * 向量值转换器
 * 将number[]数组与PostgreSQL vector类型互转
 *
 * 使用说明:
 * 1. 在实体字段上使用 @Column({ type: 'text', transformer: VectorTransformer })
 * 2. 实际向量操作(相似度查询)使用原始SQL查询
 * 3. 1536维度对应 OpenAI text-embedding-3-small 模型
 */
export const VectorTransformer: ValueTransformer = {
  /**
   * 写入数据库时: number[] -> string
   * 转换为PostgreSQL vector格式: '[0.1, 0.2, ...]'
   */
  to: (value: number[] | null | undefined): string | null => {
    if (value === null || value === undefined) return null;
    if (!Array.isArray(value)) {
      throw new Error('Vector must be an array of numbers');
    }
    if (value.length !== 1536) {
      console.warn(`Warning: Expected 1536 dimensions, got ${value.length}`);
    }
    return `[${value.join(',')}]`;
  },

  /**
   * 从数据库读取时: string -> number[]
   * PostgreSQL返回向量格式: '[0.1, 0.2, ...]'
   */
  from: (value: string | null | undefined): number[] | null => {
    if (value === null || value === undefined) return null;
    // 去掉方括号并分割
    const clean = value.replace(/[\[\]]/g, '');
    if (!clean) return [];
    return clean.split(',').map(v => {
      const num = parseFloat(v.trim());
      if (isNaN(num)) {
        throw new Error(`Invalid vector value: ${v}`);
      }
      return num;
    });
  },
};

/**
 * 向量搜索参数
 */
export interface VectorSearchParams {
  tenantId: string;
  queryVector: number[];
  limit?: number;
  minSimilarity?: number;
  category?: string;
}

/**
 * 向量搜索结果
 */
export interface VectorSearchResult<T> {
  item: T;
  similarity: number;
  distance: number;
}

/**
 * 向量运算符
 */
export enum VectorOperator {
  /**
   * L2距离 (欧几里得距离)
   * 默认距离度量
   */
  L2_DISTANCE = '<->',

  /**
   * 余弦距离
   * 推荐用于文本语义相似度
   * 余弦相似度 = 1 - 余弦距离
   */
  COSINE_DISTANCE = '<=>',

  /**
   * 内积距离
   * 适用于某些ML模型输出
   */
  INNER_PRODUCT = '<#>',
}

/**
 * 构建向量查询字符串
 * @param vector 向量数组
 * @returns PostgreSQL vector字符串格式
 */
export function buildVectorString(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

/**
 * 计算余弦相似度
 * @param distance 余弦距离
 * @returns 余弦相似度 (0-1)
 */
export function cosineSimilarityFromDistance(distance: number): number {
  return 1 - distance;
}

/**
 * 验证向量维度
 * @param vector 向量数组
 * @param expectedDimensions 期望维度 (默认1536)
 * @returns 是否有效
 */
export function validateVectorDimensions(
  vector: number[],
  expectedDimensions: number = 1536
): boolean {
  if (!Array.isArray(vector)) return false;
  if (vector.length !== expectedDimensions) return false;
  return vector.every(v => typeof v === 'number' && !isNaN(v));
}
