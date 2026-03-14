import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantFeatureEntity } from '../../entities/tenant-feature.entity';
import { FeatureDefinitionEntity } from '../../entities/feature-definition.entity';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TenantFeatureEntity, FeatureDefinitionEntity])],
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
