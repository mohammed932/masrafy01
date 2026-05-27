import { Injectable } from '@nestjs/common';
import type { Prisma, SocialProvider as PrismaSocialProvider, SocialSession } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { SocialProvider } from './dto/enums';

export interface IssueSocialSessionInput {
  provider: SocialProvider;
  providerUserId: string;
  email?: string | null;
  fullName?: string | null;
  resolvedCustomerId?: string | null;
  expiresAt: Date;
}

@Injectable()
export class SocialSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: IssueSocialSessionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SocialSession> {
    const client = tx ?? this.prisma;
    return client.socialSession.create({
      data: {
        // Local enum mirrors Prisma value-for-value; cast at the boundary.
        provider: input.provider as unknown as PrismaSocialProvider,
        providerUserId: input.providerUserId,
        email: input.email ?? null,
        fullName: input.fullName ?? null,
        resolvedCustomerId: input.resolvedCustomerId ?? null,
        expiresAt: input.expiresAt,
      },
    });
  }

  async findById(id: string): Promise<SocialSession | null> {
    return this.prisma.socialSession.findUnique({ where: { id } });
  }

  async consume(id: string, tx?: Prisma.TransactionClient): Promise<SocialSession> {
    const client = tx ?? this.prisma;
    return client.socialSession.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }
}
