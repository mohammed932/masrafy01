import { Injectable } from '@nestjs/common';
import type { PasswordResetToken, Prisma } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

export interface IssuePasswordResetTokenInput {
  customerId: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class PasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: IssuePasswordResetTokenInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PasswordResetToken> {
    const client = tx ?? this.prisma;
    return client.passwordResetToken.create({ data: input });
  }

  async findByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  async consume(id: string, tx?: Prisma.TransactionClient): Promise<PasswordResetToken> {
    const client = tx ?? this.prisma;
    return client.passwordResetToken.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }
}
