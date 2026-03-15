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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiOkResponse,
} from '@nestjs/swagger';
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

@ApiTags('Auth')
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
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ status: 200, description: '返回 accessToken 和 refreshToken' })
  @ApiResponse({ status: 401, description: '邮箱或密码错误' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '注册新用户' })
  @ApiResponse({ status: 201, description: '注册成功，返回用户信息' })
  @ApiResponse({ status: 409, description: '邮箱已注册' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新 Access Token' })
  @ApiResponse({ status: 200, description: '返回新的 accessToken' })
  @ApiResponse({ status: 401, description: 'refreshToken 无效或已过期' })
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '登出（使 refreshToken 失效）' })
  @ApiResponse({ status: 204, description: '登出成功' })
  async logout(@Req() req: RequestWithUser) {
    await this.authService.logout(req.user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '返回当前登录用户信息' })
  @ApiOkResponse({ description: '返回当前登录用户信息' })
  async getMe(@Req() req: RequestWithUser) {
    return this.usersService.findById(req.user.id);
  }

  // ── WeChat OAuth Endpoints ─────────────────────────────────────────────────────

  @Get('wechat')
  @ApiOperation({ summary: '微信 OAuth 授权重定向' })
  @ApiQuery({ name: 'redirect_uri', required: false, description: '授权后重定向地址' })
  @ApiResponse({ status: 302, description: '重定向到微信授权页面' })
  wechatAuth(@Query('redirect_uri') redirectUri: string, @Res() res: Response) {
    const callbackUrl =
      redirectUri ??
      this.configService.get<string>('WECHAT_CALLBACK_URL') ??
      `${this.configService.get('BACKEND_URL')}/auth/wechat/callback`;
    const state = this.authService.generateSecureOAuthState();
    const authUrl = this.authService.getWechatAuthUrl(callbackUrl, state);
    res.redirect(authUrl);
  }

  @Get('wechat/callback')
  @ApiOperation({ summary: '微信 OAuth 回调处理' })
  @ApiQuery({ name: 'code', required: true, description: '微信授权码' })
  @ApiQuery({ name: 'state', required: false, description: '状态参数' })
  @ApiResponse({ status: 302, description: '重定向到前端页面，携带token或错误信息' })
  async wechatCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code) {
      res.redirect(`${this.configService.get('FRONTEND_URL')}/login?error=no_code`);
      return;
    }

    // Validate OAuth state to prevent CSRF attacks
    if (!state || !this.authService.validateOAuthState(state)) {
      res.redirect(
        `${this.configService.get('FRONTEND_URL')}/login?error=${encodeURIComponent('Invalid OAuth state — possible CSRF attack')}`,
      );
      return;
    }

    try {
      const authResponse = await this.authService.loginWithWechat(code);
      // Use URL fragment (hash) instead of query string to prevent token exposure
      const frontendUrl = this.configService.get('FRONTEND_URL');
      const redirectUrl = `${frontendUrl}/auth/callback#access_token=${authResponse.accessToken}&refresh_token=${authResponse.refreshToken}`;
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
  @ApiOperation({ summary: '微信 code 换取 token（移动端）' })
  @ApiResponse({ status: 200, description: '返回 accessToken 和 refreshToken' })
  @ApiResponse({ status: 400, description: '授权码不能为空' })
  async wechatLogin(@Body('code') code: string) {
    if (!code) {
      throw new BadRequestException('授权码不能为空');
    }
    return this.authService.loginWithWechat(code);
  }
}
