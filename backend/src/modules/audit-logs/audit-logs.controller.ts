import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuditLogsService, AuditLogQuery } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { AuditAction } from '../../entities/audit-log.entity';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
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
