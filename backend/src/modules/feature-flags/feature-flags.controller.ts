import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { FeatureFlagsService, FeatureFlagItem } from './feature-flags.service';
import { FeatureFlagEnrichedResponseDto } from './dto/feature-flag-enriched-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@Controller('feature-flags')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  findAll(@Req() req: RequestWithUser): Promise<FeatureFlagItem[]> {
    return this.featureFlagsService.findAll(req.user.tenantId);
  }

  @Get('enriched')
  findAllEnriched(@Req() req: RequestWithUser): Promise<FeatureFlagEnrichedResponseDto[]> {
    return this.featureFlagsService.findAllEnriched(req.user.tenantId);
  }

  @Patch()
  @Roles('ADMIN')
  saveAll(@Req() req: RequestWithUser, @Body() body: { flags: FeatureFlagItem[] }) {
    return this.featureFlagsService.saveAll(req.user.tenantId, body.flags);
  }
}
