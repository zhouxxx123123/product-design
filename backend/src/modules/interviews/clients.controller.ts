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
import { ClientsService, ClientListQuery } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('industry') industry?: string,
  ) {
    const query: ClientListQuery = {
      page: parseInt(page ?? '1', 10) || 1,
      limit: parseInt(limit ?? '20', 10) || 20,
      search,
      industry,
    };
    return this.clientsService.findAll(req.user.tenantId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.clientsService.findById(id, req.user.tenantId);
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateClientDto) {
    return this.clientsService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Req() req: RequestWithUser, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.clientsService.softDelete(id, req.user.tenantId);
  }
}
