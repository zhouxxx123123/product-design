import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientProfileEntity } from '../../entities/client-profile.entity';
import { ClientContactEntity } from '../../entities/client-contact.entity';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ClientProfileEntity, ClientContactEntity])],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class InterviewsModule {}
