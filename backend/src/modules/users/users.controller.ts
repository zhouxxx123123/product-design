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
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserListQueryDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@Req() req: RequestWithUser) {
    return this.usersService.findById(req.user.id);
  }

  @Get()
  @Roles('ADMIN', 'EXPERT')
  findAll(
    @Req() req: RequestWithUser,
    @Query() query: UserListQueryDto,
  ) {
    return this.usersService.findAll(req.user.tenantId, query);
  }

  @Post()
  @Roles('ADMIN', 'EXPERT')
  create(@Req() req: RequestWithUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'EXPERT')
  update(@Param('id') id: string, @Req() req: RequestWithUser, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'EXPERT')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.usersService.softDelete(id, req.user.tenantId);
  }
}
