import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DataSource } from 'typeorm';
import { AuditAction } from '../../entities/audit-log.entity';

/** HTTP 方法到 AuditAction 的映射 */
const METHOD_TO_ACTION: Record<string, AuditAction> = {
  POST: AuditAction.CREATE,
  PATCH: AuditAction.UPDATE,
  PUT: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
};

/** 路径首段到实体类型的映射（/api/v1/cases → cases） */
function extractEntityType(path: string): string {
  // 去掉开头的 /，取首个路径段，去除版本前缀 (v1, api 等)
  const segments = path.replace(/^\/+/, '').split('/');
  // 如果路径以 api 或 v1 等开头，跳过前缀
  const skip = new Set(['api', 'v1', 'v2', 'v3']);
  const meaningful = segments.filter((s) => s && !skip.has(s));
  return meaningful[0] ?? 'unknown';
}

/** 从路径提取实体 ID（最后一个 UUID 形式的路径段） */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractEntityId(path: string): string | null {
  const segments = path.replace(/^\/+/, '').split('/');
  // 从后往前找第一个看起来像 UUID 的段
  for (let i = segments.length - 1; i >= 0; i--) {
    if (UUID_RE.test(segments[i])) {
      return segments[i];
    }
  }
  return null;
}

/** 过滤掉不应写入审计日志的敏感字段 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'api_key',
  'authorization',
  'credential',
  'credentials',
  'privateKey',
  'private_key',
]);

function sanitize(obj: unknown, maxDepth = 3, depth = 0): Record<string, unknown> | null {
  if (!obj || typeof obj !== 'object' || depth > maxDepth) return null;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.has(key)) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitize(value, maxDepth, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * AuditLogInterceptor - 审计日志拦截器
 *
 * 拦截所有 POST / PATCH / PUT / DELETE 请求，
 * 在响应成功后将操作记录到 audit_logs 表。
 *
 * 特性:
 * - 仅记录状态码 < 400 的成功响应
 * - 过滤密码、token 等敏感字段
 * - 不阻塞主请求流程（异步写入，错误静默忽略）
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      path: string;
      ip: string;
      headers: Record<string, string>;
      user?: { id?: string; tenantId?: string };
      body?: unknown;
    }>();

    const method = request.method?.toUpperCase();

    // 只记录写操作
    const action = METHOD_TO_ACTION[method];
    if (!action) {
      return next.handle();
    }

    const userId = request.user?.id ?? null;
    const tenantId = request.user?.tenantId;

    // 没有租户上下文的请求不记录（如登录前的请求）
    if (!tenantId) {
      return next.handle();
    }

    const entityType = extractEntityType(request.path);
    const entityId = extractEntityId(request.path);
    const ipAddress = request.ip ?? null;
    const userAgent = request.headers?.['user-agent'] ?? null;
    const newValues = sanitize(request.body);

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          // 异步写入，不阻塞响应
          const resolvedEntityId = entityId ?? this.extractIdFromResponse(responseBody);
          // entity_id 是 NOT NULL，无法解析时跳过写入（如 AI 代理路由）
          if (!resolvedEntityId) return;
          void this.writeAuditLog({
            tenantId,
            userId,
            action,
            entityType,
            entityId: resolvedEntityId,
            ipAddress,
            userAgent,
            newValues,
          });
        },
        // 失败请求不记录
      }),
    );
  }

  /** 从响应体提取新建资源的 ID（POST 请求时 entityId 可能在 path 中不存在） */
  private extractIdFromResponse(body: unknown): string | null {
    if (!body || typeof body !== 'object') return null;
    const obj = body as Record<string, unknown>;
    if (typeof obj['id'] === 'string') return obj['id'];
    if (typeof obj['data'] === 'object' && obj['data'] !== null) {
      const data = obj['data'] as Record<string, unknown>;
      if (typeof data['id'] === 'string') return data['id'];
    }
    return null;
  }

  private async writeAuditLog(params: {
    tenantId: string;
    userId: string | null;
    action: AuditAction;
    entityType: string;
    entityId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    newValues: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO audit_logs
           (id, tenant_id, user_id, action, entity_type, entity_id,
            old_values, new_values, ip_address, user_agent, created_at)
         VALUES
           (uuid_generate_v4(), $1, $2, $3, $4, $5,
            NULL, $6, $7, $8, now())`,
        [
          params.tenantId,
          params.userId,
          params.action,
          params.entityType,
          params.entityId,
          params.newValues ? JSON.stringify(params.newValues) : null,
          params.ipAddress,
          params.userAgent,
        ],
      );
    } catch (err) {
      this.logger.warn('Audit log write failed', err instanceof Error ? err.message : String(err));
    }
  }
}
