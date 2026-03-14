import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantFeatureEntity } from '../../entities/tenant-feature.entity';
import { FeatureDefinitionEntity } from '../../entities/feature-definition.entity';
import { FeatureFlagEnrichedResponseDto } from './dto/feature-flag-enriched-response.dto';

export interface FeatureFlagItem {
  key: string;
  enabled: boolean;
}

@Injectable()
export class FeatureFlagsService {
  constructor(
    @InjectRepository(TenantFeatureEntity)
    private readonly tenantFeatureRepo: Repository<TenantFeatureEntity>,
    @InjectRepository(FeatureDefinitionEntity)
    private readonly featureDefinitionRepo: Repository<FeatureDefinitionEntity>,
  ) {}

  async findAll(tenantId: string): Promise<FeatureFlagItem[]> {
    const rows = await this.tenantFeatureRepo.find({ where: { tenantId } });
    return rows.map((r) => ({ key: r.key, enabled: r.enabled }));
  }

  async findAllEnriched(tenantId: string): Promise<FeatureFlagEnrichedResponseDto[]> {
    // Load all active feature definitions, ordered by sort_order
    const definitions = await this.featureDefinitionRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });

    // Load tenant's feature states
    const tenantFeatures = await this.tenantFeatureRepo.find({
      where: { tenantId },
    });

    // Create a map for quick lookup of tenant feature states
    const tenantStateMap = new Map<string, boolean>();
    tenantFeatures.forEach((tf) => {
      tenantStateMap.set(tf.key, tf.enabled);
    });

    // Merge definitions with tenant states
    return definitions.map((definition) => ({
      id: definition.id,
      key: definition.key,
      name: definition.name,
      description: definition.description,
      category: definition.category,
      iconName: definition.iconName,
      sortOrder: definition.sortOrder,
      enabled: tenantStateMap.get(definition.key) ?? false, // Default to false if not set
    }));
  }

  async saveAll(tenantId: string, flags: FeatureFlagItem[]): Promise<FeatureFlagItem[]> {
    const entities = flags.map((f) =>
      this.tenantFeatureRepo.create({ tenantId, key: f.key, enabled: f.enabled }),
    );
    await this.tenantFeatureRepo.save(entities);
    return this.findAll(tenantId);
  }
}
