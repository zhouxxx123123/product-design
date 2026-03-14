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
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CasesService, CreateCaseDto, UpdateCaseDto } from './cases.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@Controller('cases')
@UseGuards(JwtAuthGuard)
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('industry') industry?: string,
    @Query('tags') tags?: string,
  ) {
    return this.casesService.findAll(req.user.tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      industry,
      tags,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.casesService.findById(id, req.user.tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  create(@Req() req: RequestWithUser, @Body() dto: CreateCaseDto) {
    return this.casesService.create(req.user.tenantId, req.user.id, dto);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true, skipMissingProperties: true }))
  update(@Param('id') id: string, @Req() req: RequestWithUser, @Body() dto: UpdateCaseDto) {
    return this.casesService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.casesService.softDelete(id, req.user.tenantId);
  }
}
