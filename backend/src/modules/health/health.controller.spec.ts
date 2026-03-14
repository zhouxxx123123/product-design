import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckResult, HealthCheckService } from '@nestjs/terminus';

import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './database.health';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeHealthCheckResult(status: 'ok' | 'error' = 'ok'): HealthCheckResult {
  return {
    status,
    info: { database: { status: status === 'ok' ? 'up' : 'down' } },
    error: status === 'error' ? { database: { status: 'down' } } : {},
    details: { database: { status: status === 'ok' ? 'up' : 'down' } },
  };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: { check: jest.Mock };
  let dbIndicator: { isHealthy: jest.Mock };

  beforeEach(async () => {
    healthCheckService = { check: jest.fn() };
    dbIndicator = { isHealthy: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckService },
        { provide: DatabaseHealthIndicator, useValue: dbIndicator },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── GET /health ───────────────────────────────────────────────────────────

  describe('check()', () => {
    it('calls health.check() and returns a HealthCheckResult', async () => {
      const mockResult = makeHealthCheckResult('ok');
      healthCheckService.check.mockResolvedValue(mockResult);

      const result = await controller.check();

      expect(healthCheckService.check).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockResult);
    });

    it('delegates the db indicator check to HealthCheckService', async () => {
      const mockResult = makeHealthCheckResult('ok');
      healthCheckService.check.mockImplementation(async (indicators: (() => any)[]) => {
        // call each indicator to verify it invokes dbIndicator.isHealthy
        for (const fn of indicators) await fn();
        return mockResult;
      });
      dbIndicator.isHealthy.mockResolvedValue({ database: { status: 'up' } });

      await controller.check();

      expect(dbIndicator.isHealthy).toHaveBeenCalledWith('database');
    });

    it('propagates errors from HealthCheckService (unhealthy)', async () => {
      healthCheckService.check.mockRejectedValue(new Error('Database check failed'));

      await expect(controller.check()).rejects.toThrow('Database check failed');
    });
  });

  // ── GET /health/liveness ─────────────────────────────────────────────────

  describe('liveness()', () => {
    it('returns { status: "ok" } synchronously', () => {
      const result = controller.liveness();

      expect(result).toEqual({ status: 'ok' });
    });
  });

  // ── GET /health/readiness ────────────────────────────────────────────────

  describe('readiness()', () => {
    it('returns { status: "ok" } synchronously', () => {
      const result = controller.readiness();

      expect(result).toEqual({ status: 'ok' });
    });
  });
});
