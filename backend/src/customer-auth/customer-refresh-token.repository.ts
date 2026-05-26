import { Injectable } from '@nestjs/common';
import type { Prisma, CustomerRefreshToken } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

export interface IssueCustomerRefreshTokenInput {
  customerId: string;
  tokenHash: string;
  expiresAt: Date;
  rotatedFromId?: string | null;
  userAgent?: string | null;
  sourceIp?: string | null;
  mobileClientId?: string | null;
}

export class CustomerRefreshTokenAlreadyRotatedError extends Error {
  constructor() {
    super('customer_refresh_token_already_rotated');
  }
}

@Injectable()
export class CustomerRefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async issue(
    input: IssueCustomerRefreshTokenInput,
    tx?: Prisma.TransactionClient,
  ): Promise<CustomerRefreshToken> {
    const client = tx ?? this.prisma;
    return client.customerRefreshToken.create({
      data: {
        customerId: input.customerId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        rotatedFromId: input.rotatedFromId ?? null,
        userAgent: input.userAgent ?? null,
        sourceIp: input.sourceIp ?? undefined,
        mobileClientId: input.mobileClientId ?? null,
      },
    });
  }

  async lookupByHash(tokenHash: string): Promise<CustomerRefreshToken | null> {
    return this.prisma.customerRefreshToken.findUnique({ where: { tokenHash } });
  }

  async rotate(args: {
    oldId: string;
    next: IssueCustomerRefreshTokenInput;
  }): Promise<CustomerRefreshToken> {
    return this.prisma.$transaction(async (tx) => {
      const inserted = await tx.customerRefreshToken.create({
        data: {
          customerId: args.next.customerId,
          tokenHash: args.next.tokenHash,
          expiresAt: args.next.expiresAt,
          rotatedFromId: args.oldId,
          userAgent: args.next.userAgent ?? null,
          sourceIp: args.next.sourceIp ?? undefined,
          mobileClientId: args.next.mobileClientId ?? null,
        },
      });
      const updated = await tx.customerRefreshToken.updateMany({
        where: { id: args.oldId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (updated.count !== 1) {
        throw new CustomerRefreshTokenAlreadyRotatedError();
      }
      return inserted;
    });
  }

  async revokeByHash(tokenHash: string): Promise<void> {
    await this.prisma.customerRefreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForCustomer(customerId: string): Promise<void> {
    await this.prisma.customerRefreshToken.updateMany({
      where: { customerId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
