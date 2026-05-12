import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.getOrThrow<string>('REDIS_URL');
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    this.client.on('error', (err) => this.logger.error({ msg: 'redis_error', err: err.message }));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }

  get raw(): Redis {
    return this.client;
  }

  async ping(): Promise<'PONG'> {
    return (await this.client.ping()) as 'PONG';
  }

  // --- Sliding-window helpers used by LockoutService (R-004) ---

  async zaddNow(key: string, member: string, scoreMs: number): Promise<void> {
    await this.client.zadd(key, scoreMs, member);
  }

  async trimWindow(key: string, olderThanMs: number): Promise<void> {
    await this.client.zremrangebyscore(key, '-inf', `(${olderThanMs}`);
  }

  async zcard(key: string): Promise<number> {
    return this.client.zcard(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
