import { Injectable } from '@nestjs/common';
import type { Prisma, RefreshToken } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

export interface IssueRefreshTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  rotatedFromId?: string | null;
  userAgent?: string | null;
  sourceIp?: string | null;
}

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async issue(
    input: IssueRefreshTokenInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RefreshToken> {
    const client = tx ?? this.prisma;
    return client.refreshToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        rotatedFromId: input.rotatedFromId ?? null,
        userAgent: input.userAgent ?? null,
        sourceIp: input.sourceIp ?? undefined,
      },
    });
  }

  async lookupByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  /**
   * Rotate: insert new row first, then revoke old. Wrapped in a transaction
   * so a concurrent rotation of the same token fails one of the two requests
   * (UNIQUE on tokenHash + the revokedAt guard combine to enforce this).
   */
  async rotate(args: {
    oldId: string;
    next: IssueRefreshTokenInput;
  }): Promise<RefreshToken> {
    return this.prisma.$transaction(async (tx) => {
      const inserted = await tx.refreshToken.create({
        data: {
          userId: args.next.userId,
          tokenHash: args.next.tokenHash,
          expiresAt: args.next.expiresAt,
          rotatedFromId: args.oldId,
          userAgent: args.next.userAgent ?? null,
          sourceIp: args.next.sourceIp ?? undefined,
        },
      });
      // Only revoke if the old row is still active — guarantees a concurrent
      // rotation cannot double-spend the same input token.
      const updated = await tx.refreshToken.updateMany({
        where: { id: args.oldId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (updated.count !== 1) {
        // Old token already revoked / rotated by a racing request.
        throw new RefreshTokenAlreadyRotatedError();
      }
      return inserted;
    });
  }

  async revoke(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export class RefreshTokenAlreadyRotatedError extends Error {
  constructor() {
    super('refresh_token_already_rotated');
  }
}
