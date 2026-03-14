import { Controller, Get, Delete, Query, Param, Req, UseGuards, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { MemoriesService, MemoryListQuery } from './memories.service';
import { MemoryType } from '../../entities/copilot-memory.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@Controller('memories')
@UseGuards(JwtAuthGuard)
export class MemoriesController {
  constructor(private readonly memoriesService: MemoriesService) {}

  @Get()
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: MemoryType,
  ) {
    const query: MemoryListQuery = {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      type,
    };
    return this.memoriesService.findAll(req.user.id, req.user.tenantId, query);
  }

  @Get('export')
  async export(@Req() req: RequestWithUser, @Res() res: Response) {
    const data = await this.memoriesService.exportAll(req.user.id, req.user.tenantId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="memories.json"');
    res.send(JSON.stringify(data, null, 2));
  }

  @Delete()
  deleteAll(@Req() req: RequestWithUser) {
    return this.memoriesService.deleteAll(req.user.id, req.user.tenantId);
  }

  @Delete(':id')
  deleteOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.memoriesService.deleteOne(id, req.user.id);
  }
}
