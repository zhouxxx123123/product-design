import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { StorageFileEntity } from '../../entities/storage-file.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StorageFileEntity])],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
