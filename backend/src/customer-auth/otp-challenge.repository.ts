import { Injectable } from '@nestjs/common';
import type { OtpChallenge, OtpPurpose, Prisma } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

export interface IssueOtpChallengeInput {
  customerId?: string | null;
  phone: string;
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: Date;
  attemptsLeft?: number;
}

@Injectable()
export class OtpChallengeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: IssueOtpChallengeInput,
    tx?: Prisma.TransactionClient,
  ): Promise<OtpChallenge> {
    const client = tx ?? this.prisma;
    return client.otpChallenge.create({
      data: {
        customerId: input.customerId ?? null,
        phone: input.phone,
        purpose: input.purpose,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        attemptsLeft: input.attemptsLeft ?? 5,
      },
    });
  }

  async findById(id: string): Promise<OtpChallenge | null> {
    return this.prisma.otpChallenge.findUnique({ where: { id } });
  }

  async countActiveForPhone(phone: string, since: Date): Promise<number> {
    return this.prisma.otpChallenge.count({
      where: {
        phone,
        createdAt: { gte: since },
        consumedAt: null,
      },
    });
  }

  async countSentForPhone(phone: string, since: Date): Promise<number> {
    return this.prisma.otpChallenge.count({
      where: {
        phone,
        createdAt: { gte: since },
      },
    });
  }

  async findMostRecentForPhone(phone: string): Promise<OtpChallenge | null> {
    return this.prisma.otpChallenge.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
  }

  async decrementAttempts(id: string): Promise<OtpChallenge> {
    return this.prisma.otpChallenge.update({
      where: { id },
      data: { attemptsLeft: { decrement: 1 } },
    });
  }

  async consume(id: string, tx?: Prisma.TransactionClient): Promise<OtpChallenge> {
    const client = tx ?? this.prisma;
    return client.otpChallenge.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }
}
