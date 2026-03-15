import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TranscriptService } from './transcript.service';
import { CreateSegmentDto, BulkCreateTranscriptSegmentDto } from './transcript.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@ApiTags('Transcript')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class TranscriptController {
  constructor(private readonly transcriptService: TranscriptService) {}

  @Get('sessions/:id/transcript')
  @ApiOperation({ summary: '获取会话转录段落列表' })
  @ApiParam({ name: 'id', description: '会话 ID（UUID）' })
  @ApiResponse({
    status: 200,
    description: '转录段落数组，按 startMs 排序',
  })
  findBySession(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.transcriptService.findBySession(id, req.user.tenantId);
  }

  @Post('sessions/:id/transcript')
  @ApiOperation({
    summary: '新增单条转录段落（ASR 实时流写入）',
  })
  @ApiParam({ name: 'id', description: '会话 ID（UUID）' })
  @ApiResponse({ status: 201, description: '转录段落创建成功' })
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  create(@Param('id') id: string, @Req() req: RequestWithUser, @Body() dto: CreateSegmentDto) {
    return this.transcriptService.create(id, req.user.tenantId, dto);
  }

  @Post('sessions/:id/transcript/segments')
  @ApiOperation({
    summary: '批量新增转录段落（录音文件识别后批量写入）',
  })
  @ApiParam({ name: 'id', description: '会话 ID（UUID）' })
  @ApiResponse({ status: 201, description: '转录段落批量创建成功' })
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  bulkCreate(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() dto: BulkCreateTranscriptSegmentDto,
  ) {
    return this.transcriptService.bulkCreateSegments(id, req.user.tenantId, dto);
  }
}
