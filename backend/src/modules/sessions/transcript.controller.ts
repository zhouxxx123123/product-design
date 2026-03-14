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
import { TranscriptService } from './transcript.service';
import { CreateSegmentDto, BulkCreateTranscriptSegmentDto } from './transcript.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class TranscriptController {
  constructor(private readonly transcriptService: TranscriptService) {}

  @Get('sessions/:id/transcript')
  findBySession(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.transcriptService.findBySession(id, req.user.tenantId);
  }

  @Post('sessions/:id/transcript')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  create(@Param('id') id: string, @Req() req: RequestWithUser, @Body() dto: CreateSegmentDto) {
    return this.transcriptService.create(id, req.user.tenantId, dto);
  }

  @Post('sessions/:id/transcript/segments')
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
