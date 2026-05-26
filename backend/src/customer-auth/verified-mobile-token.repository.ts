import { Injectable } from '@nestjs/common';
import type { Prisma, VerifiedMobileToken } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

export interface IssueVerifiedMobileTokenInput {
  tokenHash: string;
  phone: string;
  expiresAt: Date;
}

@Injectable()
export class VerifiedMobileTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: IssueVerifiedMobileTokenInput,
    tx?: Prisma.TransactionClient,
  ): Promise<VerifiedMobileToken> {
    const client = tx ?? this.prisma;
    return client.verifiedMobileToken.create({ data: input });
  }

  async findByHash(tokenHash: string): Promise<VerifiedMobileToken | null> {
    return this.prisma.verifiedMobileToken.findUnique({ where: { tokenHash } });
  }

  async consume(id: string, tx?: Prisma.TransactionClient): Promise<VerifiedMobileToken> {
    const client = tx ?? this.prisma;
    return client.verifiedMobileToken.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }
}
