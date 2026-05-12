import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';
import { HibpClient } from './hibp/hibp.client';
import { CommonPasswordsService } from './passwords/common-passwords';

/**
 * Global infrastructure module. Provides framework-adjacent singletons that
 * every feature module consumes: Postgres (Prisma), Redis, HIBP client, and
 * the common-password deny list loader. Marked @Global so feature modules
 * don't have to re-list them in their own `imports`.
 */
@Global()
@Module({
  providers: [PrismaService, RedisService, HibpClient, CommonPasswordsService],
  exports: [PrismaService, RedisService, HibpClient, CommonPasswordsService],
})
export class InfraModule {}
