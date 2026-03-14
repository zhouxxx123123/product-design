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
import { TemplatesService, CreateTemplateDto, UpdateTemplateDto } from './templates.service';
import { TemplateType } from '../../entities/template.entity';
import { DefaultSection } from './types/default-template.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@Controller('templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('templateType') templateType?: TemplateType,
  ) {
    return this.templatesService.findAll(req.user.tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      templateType,
    });
  }

  @Get('categories')
  @UseGuards(JwtAuthGuard)
  async getCategories(@Req() req: RequestWithUser): Promise<{ category: string; count: number }[]> {
    return this.templatesService.findCategories(req.user.tenantId);
  }

  @Get('default-structure')
  @UseGuards(JwtAuthGuard)
  async getDefaultStructure(): Promise<{ sections: DefaultSection[] }> {
    return this.templatesService.getDefaultStructure();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.templatesService.findById(id, req.user.tenantId);
  }

  @Post()
  @Roles('ADMIN', 'EXPERT')
  create(@Req() req: RequestWithUser, @Body() dto: CreateTemplateDto) {
    return this.templatesService.create(req.user.tenantId, req.user.id, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'EXPERT')
  update(@Param('id') id: string, @Req() req: RequestWithUser, @Body() dto: UpdateTemplateDto) {
    return this.templatesService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'EXPERT')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.templatesService.softDelete(id, req.user.tenantId);
  }

  @Post(':id/duplicate')
  @Roles('ADMIN', 'EXPERT')
  duplicate(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.templatesService.duplicate(id, req.user.tenantId);
  }

  @Patch(':id/default')
  @Roles('ADMIN', 'EXPERT')
  setDefault(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.templatesService.setDefault(id, req.user.tenantId);
  }
}
