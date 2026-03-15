import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuditLogsService, AuditLogQuery } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { AuditAction } from '../../entities/audit-log.entity';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @ApiOperation({
    summary: '查询审计日志（需 ADMIN）',
    description: '支持多条件过滤：用户、操作类型、实体类型、时间范围',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量' })
  @ApiQuery({ name: 'userId', required: false, type: String, description: '用户 ID' })
  @ApiQuery({
    name: 'action',
    required: false,
    type: String,
    description: '操作类型 enum: CREATE/UPDATE/DELETE/LOGIN/LOGOUT',
  })
  @ApiQuery({ name: 'entityType', required: false, type: String, description: '实体类型' })
  @ApiQuery({ name: 'entityId', required: false, type: String, description: '实体 ID' })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    type: String,
    description: 'ISO 日期字符串',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    type: String,
    description: 'ISO 日期字符串',
  })
  @ApiResponse({ status: 200, description: '审计日志列表' })
  @ApiResponse({ status: 403, description: '需要 ADMIN 权限' })
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const query: AuditLogQuery = {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      userId,
      action: action as AuditAction | undefined,
      entityType,
      entityId,
      dateFrom,
      dateTo,
    };
    return this.auditLogsService.findAll(req.user.tenantId, query);
  }
}
