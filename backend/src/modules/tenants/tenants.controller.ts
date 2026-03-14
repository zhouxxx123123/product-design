import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.tenantsService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    });
  }

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.tenantsService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string) {
    return this.tenantsService.softDelete(id);
  }

  // ── Members ──────────────────────────────────────────────────────────────────

  @Get(':id/members')
  getMembers(@Param('id') id: string) {
    return this.tenantsService.getMembers(id);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.tenantsService.addMember(id, dto);
  }

  @Delete(':id/members/:uid')
  removeMember(@Param('id') id: string, @Param('uid') uid: string) {
    return this.tenantsService.removeMember(id, uid);
  }
}
