import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  DictionaryService,
  CreateDictionaryNodeDto,
  UpdateDictionaryNodeDto,
} from './dictionary.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@Controller('dictionary')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DictionaryController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  @Get()
  findAll(@Req() req: RequestWithUser, @Query('parentId') parentId?: string) {
    return this.dictionaryService.findAll(req.user.tenantId, parentId);
  }

  @Post()
  @Roles('ADMIN', 'EXPERT')
  create(@Req() req: RequestWithUser, @Body() dto: CreateDictionaryNodeDto) {
    return this.dictionaryService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'EXPERT')
  update(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateDictionaryNodeDto,
  ) {
    return this.dictionaryService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'EXPERT')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.dictionaryService.softDelete(id, req.user.tenantId);
  }
}
