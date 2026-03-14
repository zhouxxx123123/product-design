import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { InsightsService } from './insights.service';
import { CreateInsightDto, UpdateInsightDto } from './insights.dto';
import { SessionInsightEntity } from '../../entities/session-insight.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get('sessions/:id/insights')
  findBySession(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.insightsService.findBySession(id, req.user.tenantId);
  }

  @Post('sessions/:id/insights/extract')
  @HttpCode(HttpStatus.OK)
  async extractFromSession(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<SessionInsightEntity[]> {
    return this.insightsService.extractFromSession(id, req.user.tenantId, req.user.id);
  }

  @Post('sessions/:id/insights')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  create(@Param('id') id: string, @Req() req: RequestWithUser, @Body() dto: CreateInsightDto) {
    return this.insightsService.create(id, req.user.tenantId, req.user.id, dto);
  }

  @Patch('insights/:id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true, skipMissingProperties: true }))
  update(@Param('id') id: string, @Req() req: RequestWithUser, @Body() dto: UpdateInsightDto) {
    return this.insightsService.update(id, req.user.tenantId, req.user.id, dto);
  }

  @Delete('insights/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @Req() req: RequestWithUser): Promise<void> {
    await this.insightsService.delete(id, req.user.tenantId);
  }
}
