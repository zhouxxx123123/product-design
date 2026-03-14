import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CopilotMemoryEntity } from '../../entities/copilot-memory.entity';
import { MemoriesService } from './memories.service';
import { MemoriesController } from './memories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CopilotMemoryEntity])],
  controllers: [MemoriesController],
  providers: [MemoriesService],
  exports: [MemoriesService],
})
export class MemoriesModule {}
