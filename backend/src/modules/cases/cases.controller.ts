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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CasesService, CreateCaseDto, UpdateCaseDto } from './cases.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@ApiTags('Cases')
@ApiBearerAuth()
@Controller('cases')
@UseGuards(JwtAuthGuard)
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  @ApiOperation({ summary: '获取案例库列表（分页）' })
  @ApiQuery({ name: 'page', required: false, description: '页码，从1开始' })
  @ApiQuery({ name: 'limit', required: false, description: '每页条数' })
  @ApiQuery({ name: 'search', required: false, description: '搜索关键词（标题或内容）' })
  @ApiQuery({ name: 'industry', required: false, description: '行业筛选' })
  @ApiQuery({ name: 'tags', required: false, description: '标签筛选' })
  @ApiResponse({ status: 200, description: '返回案例列表和分页信息' })
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

  @Get('similar')
  @ApiOperation({ summary: '语义相似案例搜索（向量检索）' })
  @ApiQuery({ name: 'text', required: true, type: String, description: '语义搜索文本（不能为空）' })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
    description: '返回条数（1-20，默认10）',
  })
  @ApiResponse({ status: 200, description: '返回相似案例列表，按相似度排序' })
  async findSimilar(
    @Req() req: RequestWithUser,
    @Query('text') text: string,
    @Query('limit') limit?: string,
  ) {
    if (!text?.trim()) {
      return { data: [], total: 0 };
    }
    const results = await this.casesService.similarSearch(
      req.user.tenantId,
      text.trim(),
      limit ? Math.min(parseInt(limit, 10), 20) : 10,
    );
    return { data: results, total: results.length };
  }

  @Get(':id')
  @ApiOperation({ summary: '获取案例详情' })
  @ApiParam({ name: 'id', description: '案例ID' })
  @ApiResponse({ status: 200, description: '返回案例详细信息' })
  @ApiResponse({ status: 404, description: '案例不存在' })
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.casesService.findById(id, req.user.tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: '创建案例' })
  @ApiResponse({ status: 201, description: '案例创建成功' })
  @ApiResponse({ status: 400, description: '请求参数无效' })
  create(@Req() req: RequestWithUser, @Body() dto: CreateCaseDto) {
    return this.casesService.create(req.user.tenantId, req.user.id, dto);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true, skipMissingProperties: true }))
  @ApiOperation({ summary: '更新案例' })
  @ApiParam({ name: 'id', description: '案例ID' })
  @ApiResponse({ status: 200, description: '案例更新成功' })
  @ApiResponse({ status: 404, description: '案例不存在' })
  update(@Param('id') id: string, @Req() req: RequestWithUser, @Body() dto: UpdateCaseDto) {
    return this.casesService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '软删除案例' })
  @ApiParam({ name: 'id', description: '案例ID' })
  @ApiResponse({ status: 200, description: '案例删除成功' })
  @ApiResponse({ status: 404, description: '案例不存在' })
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.casesService.softDelete(id, req.user.tenantId);
  }
}
