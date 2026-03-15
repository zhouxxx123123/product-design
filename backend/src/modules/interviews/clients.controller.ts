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
import { ClientsService, ClientListQuery } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@ApiTags('Clients (CRM)')
@ApiBearerAuth()
@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: '获取客户列表（分页）' })
  @ApiQuery({ name: 'page', required: false, description: '页码，从1开始' })
  @ApiQuery({ name: 'limit', required: false, description: '每页条数' })
  @ApiQuery({ name: 'search', required: false, description: '搜索关键词（客户名称）' })
  @ApiQuery({ name: 'industry', required: false, description: '行业筛选' })
  @ApiResponse({ status: 200, description: '返回客户列表和分页信息' })
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
  @ApiOperation({ summary: '获取客户详情' })
  @ApiParam({ name: 'id', description: '客户ID' })
  @ApiResponse({ status: 200, description: '返回客户详细信息' })
  @ApiResponse({ status: 404, description: '客户不存在' })
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.clientsService.findById(id, req.user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: '创建客户' })
  @ApiResponse({ status: 201, description: '客户创建成功' })
  @ApiResponse({ status: 400, description: '请求参数无效' })
  create(@Req() req: RequestWithUser, @Body() dto: CreateClientDto) {
    return this.clientsService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新客户信息' })
  @ApiParam({ name: 'id', description: '客户ID' })
  @ApiResponse({ status: 200, description: '客户信息更新成功' })
  @ApiResponse({ status: 404, description: '客户不存在' })
  update(@Param('id') id: string, @Req() req: RequestWithUser, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '软删除客户' })
  @ApiParam({ name: 'id', description: '客户ID' })
  @ApiResponse({ status: 200, description: '客户删除成功' })
  @ApiResponse({ status: 404, description: '客户不存在' })
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.clientsService.softDelete(id, req.user.tenantId);
  }
}
