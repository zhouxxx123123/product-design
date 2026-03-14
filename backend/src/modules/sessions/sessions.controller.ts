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
import { SessionsService } from './sessions.service';
import { CreateSessionDto, UpdateSessionDto } from './dto';
import { InterviewStatus } from '../../entities/interview-session.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

interface UpdateStatusBody {
  status: InterviewStatus;
}

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: InterviewStatus,
    @Query('clientId') clientId?: string,
  ) {
    return this.sessionsService.findAll(req.user.tenantId, {
      page: page ? parseInt(page, 10) || 1 : undefined,
      limit: limit ? parseInt(limit, 10) || 20 : undefined,
      search,
      status,
      clientId,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.sessionsService.findById(id, req.user.tenantId);
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateSessionDto) {
    return this.sessionsService.create(req.user.tenantId, req.user.id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Req() req: RequestWithUser, @Body() dto: UpdateSessionDto) {
    return this.sessionsService.update(id, req.user.tenantId, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() body: UpdateStatusBody,
  ) {
    return this.sessionsService.updateStatus(id, req.user.tenantId, body.status);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.sessionsService.softDelete(id, req.user.tenantId);
  }

  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() body: { content: string; targetType?: string; targetId?: string },
  ) {
    return this.sessionsService.addComment(
      id,
      req.user.id,
      req.user.tenantId,
      body.content,
      body.targetType,
      body.targetId,
    );
  }

  @Get(':id/comments')
  getComments(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.sessionsService.getComments(id, req.user.tenantId);
  }

  @Post(':id/cases')
  addCaseLink(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() body: { caseId: string; reason?: string },
  ) {
    return this.sessionsService.addCaseLink(
      id,
      body.caseId,
      req.user.tenantId,
      req.user.id,
      body.reason,
    );
  }

  @Get(':id/cases')
  getCaseLinks(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.sessionsService.getCaseLinks(id, req.user.tenantId);
  }
}
