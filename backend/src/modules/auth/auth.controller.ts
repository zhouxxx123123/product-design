import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtUser } from './strategies/jwt.strategy';
import { UsersService } from '../users/users.service';

interface RequestWithUser extends Request {
  user: JwtUser;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: RequestWithUser) {
    await this.authService.logout(req.user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: RequestWithUser) {
    return this.usersService.findById(req.user.id);
  }

  // ── WeChat OAuth Endpoints ─────────────────────────────────────────────────────

  @Get('wechat')
  wechatAuth(@Query('redirect_uri') redirectUri: string, @Res() res: Response) {
    const callbackUrl =
      redirectUri ??
      this.configService.get<string>('WECHAT_CALLBACK_URL') ??
      `${this.configService.get('BACKEND_URL')}/auth/wechat/callback`;
    const state = Math.random().toString(36).substring(2, 15);
    const authUrl = this.authService.getWechatAuthUrl(callbackUrl, state);
    res.redirect(authUrl);
  }

  @Get('wechat/callback')
  async wechatCallback(
    @Query('code') code: string,
    @Query('state') _state: string,
    @Res() res: Response,
  ) {
    if (!code) {
      res.redirect(`${this.configService.get('FRONTEND_URL')}/login?error=no_code`);
      return;
    }

    try {
      const authResponse = await this.authService.loginWithWechat(code);
      // 重定向前端，并携带 token
      const frontendUrl = this.configService.get('FRONTEND_URL');
      const redirectUrl = `${frontendUrl}/auth/callback?access_token=${authResponse.accessToken}&refresh_token=${authResponse.refreshToken}`;
      res.redirect(redirectUrl);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'unknown_error';
      res.redirect(
        `${this.configService.get('FRONTEND_URL')}/login?error=${encodeURIComponent(errorMessage)}`,
      );
    }
  }

  @Post('wechat/login')
  @HttpCode(HttpStatus.OK)
  async wechatLogin(@Body('code') code: string) {
    if (!code) {
      throw new BadRequestException('授权码不能为空');
    }
    return this.authService.loginWithWechat(code);
  }
}
