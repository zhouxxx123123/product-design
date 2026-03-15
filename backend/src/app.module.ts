import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { CasesModule } from './modules/cases/cases.module';
import { InterviewsModule } from './modules/interviews/interviews.module';
import { InsightsModule } from './modules/insights/insights.module';
import { StorageModule } from './modules/storage/storage.module';
import { HealthModule } from './modules/health/health.module';
import { AiProxyModule } from './modules/ai-proxy/ai-proxy.module';
import { DictionaryModule } from './modules/dictionary/dictionary.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { MemoriesModule } from './modules/memories/memories.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { TranscriptionWsModule } from './modules/transcription-ws/transcription-ws.module';
import { DatabaseConfig } from './config/database.config';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // 加载顺序：根目录变量 → 服务本地覆盖（后者优先）
      envFilePath: ['../.env', '.env', '.env.local'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    AuthModule,
    UsersModule,
    SessionsModule,
    CasesModule,
    InterviewsModule,
    InsightsModule,
    StorageModule,
    HealthModule,
    AiProxyModule,
    DictionaryModule,
    FeatureFlagsModule,
    MemoriesModule,
    AuditLogsModule,
    TenantsModule,
    PermissionsModule,
    TranscriptionWsModule,
  ],
  providers: [
    // 0. 全局限流守卫
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // 1. 租户上下文拦截器: 优先执行，为 RLS 设置 PostgreSQL 会话变量
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
    // 2. 审计日志拦截器: 在租户上下文建立后执行，记录写操作
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
