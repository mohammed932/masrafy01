import { Controller, Get, HttpCode, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { RedisService } from '@/infra/redis/redis.service';

class HealthNotReadyError extends HttpException {
  constructor(checks: Record<string, 'ok' | 'fail'>) {
    super({ status: 'not_ready', checks }, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('live')
  @HttpCode(200)
  @ApiOperation({ summary: 'Liveness — process is running' })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness — Postgres + Redis reachable' })
  async ready(): Promise<{ status: 'ok'; checks: Record<string, 'ok' | 'fail'> }> {
    const checks: Record<string, 'ok' | 'fail'> = { postgres: 'fail', redis: 'fail' };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.postgres = 'ok';
    } catch (err) {
      this.logger.warn({ msg: 'health_postgres_fail', err: this.errString(err) });
    }
    try {
      const pong = await this.redis.ping();
      if (pong === 'PONG') checks.redis = 'ok';
    } catch (err) {
      this.logger.warn({ msg: 'health_redis_fail', err: this.errString(err) });
    }
    if (Object.values(checks).some((v) => v === 'fail')) {
      throw new HealthNotReadyError(checks);
    }
    return { status: 'ok', checks };
  }

  private errString(err: unknown): string {
    return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }
}
