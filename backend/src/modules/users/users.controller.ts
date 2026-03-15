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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserListQueryDto, UserResponseDto, UserRole } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: '获取当前登录用户信息' })
  @ApiResponse({ status: 200, description: '返回当前用户详细信息', type: UserResponseDto })
  getMe(@Req() req: RequestWithUser): Promise<UserResponseDto> {
    return this.usersService.findById(req.user.id);
  }

  @Get()
  @Roles('ADMIN', 'EXPERT')
  @ApiOperation({ summary: '获取用户列表（分页）' })
  @ApiQuery({ name: 'page', required: false, description: '页码，从1开始' })
  @ApiQuery({ name: 'limit', required: false, description: '每页条数' })
  @ApiQuery({ name: 'search', required: false, description: '搜索关键词（姓名或邮箱）' })
  @ApiResponse({ status: 200, description: '返回用户列表和分页信息' })
  @ApiResponse({ status: 403, description: '权限不足' })
  findAll(@Req() req: RequestWithUser, @Query() query: UserListQueryDto) {
    return this.usersService.findAll(req.user.tenantId, query);
  }

  @Post()
  @Roles('ADMIN', 'EXPERT')
  @ApiOperation({ summary: '创建用户' })
  @ApiResponse({ status: 201, description: '用户创建成功', type: UserResponseDto })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 409, description: '邮箱已存在' })
  create(@Req() req: RequestWithUser, @Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'EXPERT')
  @ApiOperation({ summary: '更新用户信息' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiResponse({ status: 200, description: '用户信息更新成功', type: UserResponseDto })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  update(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, req.user.tenantId, dto, req.user.role as UserRole);
  }

  @Delete(':id')
  @Roles('ADMIN', 'EXPERT')
  @ApiOperation({ summary: '软删除用户' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiResponse({ status: 200, description: '用户删除成功' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.usersService.softDelete(id, req.user.tenantId);
  }
}
