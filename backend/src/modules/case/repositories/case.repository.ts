import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CaseEntity } from '../../../entities/case.entity';
import {
  buildVectorString,
  cosineSimilarityFromDistance,
} from '../../../database/vector-column-type';

/**
 * 案例Repository
 * 包含向量搜索功能
 */
@Injectable()
export class CaseRepository extends Repository<CaseEntity> {
  constructor(private dataSource: DataSource) {
    super(CaseEntity, dataSource.createEntityManager());
  }

  /**
   * 向量相似度搜索
   * 使用余弦相似度计算，返回相似度大于阈值的结果
   *
   * @param tenantId 租户ID
   * @param queryVector 查询向量 (1536维)
   * @param limit 返回数量 (默认10)
   * @param minSimilarity 最小相似度阈值 (默认0.8)
   * @returns 案例列表及相似度分数
   *
   * @example
   * const results = await caseRepo.searchSimilar(
   *   'tenant-uuid',
   *   [0.1, 0.2, ...], // 1536维向量
   *   10,
   *   0.8
   * );
   */
  async searchSimilar(
    tenantId: string,
    queryVector: number[],
    limit: number = 10,
    minSimilarity: number = 0.8,
  ): Promise<Array<CaseEntity & { similarity: number }>> {
    const vectorStr = buildVectorString(queryVector);

    const results = await this.dataSource.query(
      `
      SELECT
        id,
        tenant_id,
        created_by,
        title,
        industry,
        case_type,
        content,
        summary,
        tags,
        metadata,
        is_public,
        status,
        created_at,
        updated_at,
        deleted_at,
        1 - (embedding <=> $1::vector) AS similarity
      FROM cases
      WHERE tenant_id = $2
        AND is_public = true
        AND deleted_at IS NULL
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) >= $3
      ORDER BY embedding <=> $1::vector
      LIMIT $4
      `,
      [vectorStr, tenantId, minSimilarity, limit],
    );

    return (results as Record<string, unknown>[]).map((row) => {
      const entity = this.manager.create(CaseEntity);
      Object.assign(entity, row, {
        caseType: row['case_type'],
        isPublic: row['is_public'],
        createdBy: row['created_by'],
        createdAt: row['created_at'],
        updatedAt: row['updated_at'],
        deletedAt: row['deleted_at'],
      });
      return { ...entity, similarity: parseFloat(row['similarity'] as string) } as CaseEntity & {
        similarity: number;
      };
    });
  }

  /**
   * 使用IVFFlat索引的近似搜索
   * 通过调整probes参数平衡速度和精度
   *
   * @param tenantId 租户ID
   * @param queryVector 查询向量
   * @param probes 搜索聚类数 (默认10，越大越精确但越慢)
   * @param limit 返回数量
   * @returns 案例列表及距离分数
   *
   * @example
   * // 高精度搜索 (probes=50，召回率~95%)
   * const results = await caseRepo.searchSimilarApproximate(
   *   'tenant-uuid',
   *   queryVector,
   *   50,
   *   10
   * );
   *
   * // 快速搜索 (probes=5，召回率~85%)
   * const results = await caseRepo.searchSimilarApproximate(
   *   'tenant-uuid',
   *   queryVector,
   *   5,
   *   10
   * );
   */
  async searchSimilarApproximate(
    tenantId: string,
    queryVector: number[],
    probes: number = 10,
    limit: number = 10,
  ): Promise<Array<CaseEntity & { distance: number; similarity: number }>> {
    const vectorStr = buildVectorString(queryVector);

    // 设置probes参数提高召回率
    // 默认ivfflat.probes = 1，只搜索最近的1个聚类
    await this.dataSource.query(`SET LOCAL ivfflat.probes = ${probes}`);

    try {
      const results = await this.dataSource.query(
        `
        SELECT
          *,
          embedding <=> $1::vector AS distance
        FROM cases
        WHERE tenant_id = $2
          AND deleted_at IS NULL
          AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $3
        `,
        [vectorStr, tenantId, limit],
      );

      return (results as Record<string, unknown>[]).map((row) => {
        const distance = parseFloat(row['distance'] as string);
        const entity = this.manager.create(CaseEntity);
        Object.assign(entity, row, {
          caseType: row['case_type'],
          isPublic: row['is_public'],
          createdBy: row['created_by'],
          createdAt: row['created_at'],
          updatedAt: row['updated_at'],
          deletedAt: row['deleted_at'],
        });
        return {
          ...entity,
          distance,
          similarity: cosineSimilarityFromDistance(distance),
        } as CaseEntity & { distance: number; similarity: number };
      });
    } finally {
      // 重置probes为默认值
      await this.dataSource.query('SET LOCAL ivfflat.probes = 1');
    }
  }

  /**
   * 批量更新案例embedding
   * 通常在AI处理完成后调用
   *
   * @param caseId 案例ID
   * @param embedding 向量数组 (1536维)
   */
  async updateEmbedding(caseId: string, embedding: number[]): Promise<void> {
    const vectorStr = buildVectorString(embedding);

    await this.dataSource.query('UPDATE cases SET embedding = $1::vector WHERE id = $2', [
      vectorStr,
      caseId,
    ]);
  }

  /**
   * 批量更新多个案例的embedding
   *
   * @param updates 案例ID和向量的映射
   */
  async batchUpdateEmbeddings(
    updates: Array<{ caseId: string; embedding: number[] }>,
  ): Promise<void> {
    if (updates.length === 0) return;

    const values = updates.map((u, i) => `($${i * 2 + 1}::uuid, $${i * 2 + 2}::vector)`).join(', ');

    const params = updates.flatMap((u) => [u.caseId, buildVectorString(u.embedding)]);

    await this.dataSource.query(
      `
      UPDATE cases
      SET embedding = data.embedding
      FROM (
        VALUES ${values}
      ) AS data(id, embedding)
      WHERE cases.id = data.id
      `,
      params,
    );
  }

  /**
   * 查找没有embedding的案例
   * 用于批量处理任务
   *
   * @param tenantId 租户ID (可选)
   * @param limit 数量限制
   */
  async findCasesWithoutEmbedding(tenantId?: string, limit: number = 100): Promise<CaseEntity[]> {
    const qb = this.createQueryBuilder('case')
      .where('case.embedding IS NULL')
      .andWhere('case.deletedAt IS NULL')
      .limit(limit);

    if (tenantId) {
      qb.andWhere('case.tenantId = :tenantId', { tenantId });
    }

    return qb.getMany();
  }
}
