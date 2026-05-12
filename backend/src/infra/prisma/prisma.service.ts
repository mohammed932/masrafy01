import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Run a callback inside a SERIALIZABLE transaction with a single retry on
   * Postgres serialization failure (40001). Used by the super_admin floor guard
   * per research R-007.
   */
  async runSerializable<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const attempt = async (): Promise<T> =>
      this.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    try {
      return await attempt();
    } catch (err) {
      if (this.isSerializationFailure(err)) {
        // Retry once.
        return attempt();
      }
      throw err;
    }
  }

  private isSerializationFailure(err: unknown): boolean {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // Prisma surfaces Postgres SQLSTATE 40001 as code "P2034" (write conflict).
      return err.code === 'P2034';
    }
    return false;
  }
}
