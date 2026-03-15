import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
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

@ApiTags('Feature Flags')
@ApiBearerAuth()
@Controller('feature-flags')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  @ApiOperation({ summary: '获取当前租户功能开关列表' })
  @ApiResponse({ status: 200, description: '返回功能开关配置列表' })
  findAll(@Req() req: RequestWithUser): Promise<FeatureFlagItem[]> {
    return this.featureFlagsService.findAll(req.user.tenantId);
  }

  @Get('enriched')
  @ApiOperation({ summary: '获取功能开关富信息列表（含定义元数据）' })
  @ApiResponse({ status: 200, description: '返回功能开关配置和元数据信息' })
  findAllEnriched(@Req() req: RequestWithUser): Promise<FeatureFlagEnrichedResponseDto[]> {
    return this.featureFlagsService.findAllEnriched(req.user.tenantId);
  }

  @Patch()
  @Roles('ADMIN')
  @ApiOperation({ summary: '批量保存功能开关状态（需 ADMIN）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        flags: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              enabled: { type: 'boolean' },
            },
          },
        },
      },
      required: ['flags'],
    },
  })
  @ApiResponse({ status: 200, description: '功能开关配置保存成功' })
  @ApiResponse({ status: 403, description: '权限不足' })
  saveAll(@Req() req: RequestWithUser, @Body() body: { flags: FeatureFlagItem[] }) {
    return this.featureFlagsService.saveAll(req.user.tenantId, body.flags);
  }
}
