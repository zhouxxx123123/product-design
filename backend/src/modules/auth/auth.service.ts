import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import { UserEntity, UserRole } from '../../entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    displayName: string;
    email: string;
    role: UserRole;
    tenantId: string | null;
    isActive: boolean;
  };
}

export interface WechatUserInfo {
  openid: string;
  unionid?: string;
  nickname?: string;
  headimgurl?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponse> {
    // Load password (select: false) explicitly
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .addSelect('user.refreshToken')
      .where('user.email = :email', { email: dto.email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    if (!user.isActive) {
      throw new ForbiddenException('账号已被禁用');
    }

    if (!user.password) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const tokens = await this.generateTokens(user);
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        displayName: user.displayName ?? user.email,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        isActive: user.isActive,
      },
    };
  }

  async refreshToken(
    rawRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(rawRefreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('无效的 refresh token');
    }

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.refreshToken')
      .where('user.id = :id', { id: payload.sub })
      .getOne();

    if (!user?.refreshToken) {
      throw new UnauthorizedException('无效的 refresh token');
    }

    const tokenMatch = await bcrypt.compare(rawRefreshToken, user.refreshToken);
    if (!tokenMatch) {
      throw new UnauthorizedException('无效的 refresh token');
    }

    if (!user.isActive) {
      throw new ForbiddenException('账号已被禁用');
    }

    const tokens = await this.generateTokens(user);
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async logout(userId: string): Promise<void> {
    await this.userRepository.update({ id: userId }, { refreshToken: null });
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('邮箱已被注册');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      displayName: dto.displayName ?? null,
      role: UserRole.SALES,
      isActive: true,
      tenantId: null,
    });
    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user);
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        displayName: user.displayName ?? user.email,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        isActive: user.isActive,
      },
    };
  }

  private async generateTokens(
    user: UserEntity,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const jwtPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId ?? '',
    };

    const accessSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const accessExpiry = this.configService.get<string>('JWT_EXPIRY', '15m');
    const refreshExpiry = this.configService.get<string>('JWT_REFRESH_EXPIRY', '7d');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(jwtPayload, {
        secret: accessSecret,
        expiresIn: accessExpiry,
      }),
      this.jwtService.signAsync(jwtPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpiry,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshTokenHash(userId: string, rawRefreshToken: string): Promise<void> {
    const hash = await bcrypt.hash(rawRefreshToken, 10);
    await this.userRepository.update({ id: userId }, { refreshToken: hash });
  }

  // ── WeChat OAuth Methods ─────────────────────────────────────────────────────

  /**
   * 生成微信扫码登录链接
   */
  getWechatAuthUrl(redirectUri: string, state?: string): string {
    const appId = this.configService.get<string>('WECHAT_APP_ID');
    if (!appId) {
      throw new BadRequestException('微信登录未配置');
    }

    const params = new URLSearchParams({
      appid: appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'snsapi_login',
      state: state ?? Math.random().toString(36).substring(7),
    });

    return `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`;
  }

  /**
   * 通过授权码获取微信用户信息
   */
  async loginWithWechat(code: string): Promise<AuthResponse> {
    const appId = this.configService.getOrThrow<string>('WECHAT_APP_ID');
    const appSecret = this.configService.getOrThrow<string>('WECHAT_APP_SECRET');

    // 1. 通过 code 获取 access_token
    const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;

    let tokenRes: {
      data: {
        access_token?: string;
        openid?: string;
        unionid?: string;
        errcode?: number;
        errmsg?: string;
      };
    };
    try {
      tokenRes = await axios.get(tokenUrl);
    } catch (error) {
      throw new UnauthorizedException('微信登录失败：无法获取访问令牌');
    }

    const { access_token, openid, unionid, errcode, errmsg } = tokenRes.data;
    if (errcode) {
      throw new UnauthorizedException(`微信登录失败：${errmsg ?? '未知错误'}`);
    }

    if (!access_token || !openid) {
      throw new UnauthorizedException('微信登录失败：无效的响应');
    }

    // 2. 获取用户信息
    const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}`;

    let userInfo: WechatUserInfo;
    try {
      const userInfoRes = await axios.get(userInfoUrl);
      userInfo = userInfoRes.data;
    } catch {
      // 如果获取用户信息失败，使用基本信息
      userInfo = { openid, unionid };
    }

    // 3. 查找或创建用户
    let user = await this.userRepository.findOne({
      where: [{ wechatOpenId: openid }, ...(unionid ? [{ wechatUnionId: unionid }] : [])],
    });

    if (!user) {
      // 创建新用户
      const email = `wechat_${openid}@openclaw.io`;
      user = this.userRepository.create({
        email,
        displayName: userInfo.nickname ?? `微信用户${openid.slice(-4)}`,
        avatarUrl: userInfo.headimgurl ?? null,
        wechatOpenId: openid,
        wechatUnionId: unionid ?? null,
        role: UserRole.SALES,
        isActive: true,
        password: null,
      });
      await this.userRepository.save(user);
    } else {
      // 更新微信信息（如果之前没有）
      if (!user.wechatOpenId) {
        user.wechatOpenId = openid;
      }
      if (!user.wechatUnionId && unionid) {
        user.wechatUnionId = unionid;
      }
      if (userInfo.nickname && !user.displayName) {
        user.displayName = userInfo.nickname;
      }
      if (userInfo.headimgurl && !user.avatarUrl) {
        user.avatarUrl = userInfo.headimgurl;
      }
      await this.userRepository.save(user);
    }

    if (!user.isActive) {
      throw new ForbiddenException('账号已被禁用');
    }

    // 4. 生成令牌
    const tokens = await this.generateTokens(user);
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        displayName: user.displayName ?? user.email,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        isActive: user.isActive,
      },
    };
  }
}
