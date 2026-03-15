import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { CaseEntity } from '../../entities/case.entity';
import { CasesService } from './cases.service';
import { CasesController } from './cases.controller';
import { CaseRepository } from '../case/repositories/case.repository';

@Module({
  imports: [TypeOrmModule.forFeature([CaseEntity]), HttpModule],
  controllers: [CasesController],
  providers: [CasesService, CaseRepository],
  exports: [CasesService],
})
export class CasesModule {}
