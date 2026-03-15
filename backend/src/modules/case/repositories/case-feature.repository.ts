import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CaseFeatureEntity } from '../../../entities/case-feature.entity';
import { CaseEntity } from '../../../entities/case.entity';
import { buildVectorString } from '../../../database/vector-column-type';

/**
 * 案例要素Repository
 * 支持要素级向量搜索
 */
@Injectable()
export class CaseFeatureRepository extends Repository<CaseFeatureEntity> {
  constructor(private dataSource: DataSource) {
    super(CaseFeatureEntity, dataSource.createEntityManager());
  }

  /**
   * 案例要素向量相似度搜索
   * 可用于查找特定类型的要素(如痛点、需求等)
   *
   * @param tenantId 租户ID
   * @param queryVector 查询向量
   * @param options 搜索选项
   * @returns 要素列表及相似度
   */
  async searchSimilarFeatures(
    tenantId: string,
    queryVector: number[],
    options: {
      category?: string;
      limit?: number;
      minSimilarity?: number;
    } = {},
  ): Promise<
    Array<{
      feature: CaseFeatureEntity;
      caseItem: Partial<CaseEntity>;
      similarity: number;
    }>
  > {
    const { category, limit = 20, minSimilarity = 0.7 } = options;
    const vectorStr = buildVectorString(queryVector);

    let sql = `
      SELECT
        cf.id,
        cf.case_id,
        cf.category,
        cf.content,
        cf.summary,
        cf.importance_score,
        cf.sort_order,
        cf.metadata,
        cf.created_at,
        cf.updated_at,
        cf.deleted_at,
        c.id as case_id_ref,
        c.title as case_title,
        c.industry as case_industry,
        c.case_type as case_case_type,
        1 - (cf.embedding <=> $1::vector) AS similarity
      FROM case_features cf
      JOIN cases c ON cf.case_id = c.id
      WHERE c.tenant_id = $2
        AND c.deleted_at IS NULL
        AND cf.embedding IS NOT NULL
        AND 1 - (cf.embedding <=> $1::vector) >= $3
    `;

    const params: (string | number)[] = [vectorStr, tenantId, minSimilarity];

    if (category) {
      sql += ` AND cf.category = $${params.length + 1}`;
      params.push(category);
    }

    sql += `
      ORDER BY cf.embedding <=> $1::vector
      LIMIT $${params.length + 1}
    `;
    params.push(limit);

    const results = await this.dataSource.query(sql, params);

    return (results as Record<string, unknown>[]).map((row) => {
      const feature = this.manager.create(CaseFeatureEntity);
      Object.assign(feature, {
        id: row['id'],
        caseId: row['case_id'],
        category: row['category'],
        content: row['content'],
        summary: row['summary'],
        importanceScore: row['importance_score'],
        sortOrder: row['sort_order'],
        metadata: row['metadata'],
        createdAt: row['created_at'],
        updatedAt: row['updated_at'],
        deletedAt: row['deleted_at'],
      });
      return {
        feature,
        caseItem: {
          id: row['case_id_ref'] as string | undefined,
          title: row['case_title'] as string | undefined,
          industry: row['case_industry'] as string | undefined,
          caseType: row['case_case_type'] as CaseEntity['caseType'] | undefined,
        } as Partial<CaseEntity>,
        similarity: parseFloat(row['similarity'] as string),
      };
    });
  }

  /**
   * 查找案例中最相关的要素
   * 用于案例详情页的"相关要点"
   *
   * @param caseId 案例ID
   * @param queryVector 查询向量
   * @param limit 返回数量
   */
  async findMostRelevantInCase(
    caseId: string,
    queryVector: number[],
    limit: number = 5,
  ): Promise<Array<CaseFeatureEntity & { similarity: number }>> {
    const vectorStr = buildVectorString(queryVector);

    const results = await this.dataSource.query(
      `
      SELECT
        *,
        1 - (embedding <=> $1::vector) AS similarity
      FROM case_features
      WHERE case_id = $2
        AND embedding IS NOT NULL
        AND deleted_at IS NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $3
      `,
      [vectorStr, caseId, limit],
    );

    return (results as Record<string, unknown>[]).map((row) => {
      const entity = this.manager.create(CaseFeatureEntity);
      Object.assign(entity, row, {
        caseId: row['case_id'],
        importanceScore: row['importance_score'],
        sortOrder: row['sort_order'],
        createdAt: row['created_at'],
        updatedAt: row['updated_at'],
        deletedAt: row['deleted_at'],
      });
      return {
        ...entity,
        similarity: parseFloat(row['similarity'] as string),
      } as CaseFeatureEntity & { similarity: number };
    });
  }

  /**
   * 批量更新要素embedding
   */
  async updateEmbedding(featureId: string, embedding: number[]): Promise<void> {
    const vectorStr = buildVectorString(embedding);

    await this.dataSource.query('UPDATE case_features SET embedding = $1::vector WHERE id = $2', [
      vectorStr,
      featureId,
    ]);
  }

  /**
   * 获取案例的所有要素 (按重要度排序)
   */
  async findByCaseId(caseId: string): Promise<CaseFeatureEntity[]> {
    return this.find({
      where: { caseId },
      order: { importanceScore: 'DESC', sortOrder: 'ASC' },
    });
  }
}
