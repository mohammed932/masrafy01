import { Injectable } from '@nestjs/common';
import type { OtpChallenge, OtpPurpose as PrismaOtpPurpose, Prisma } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { OtpPurpose } from './dto/enums';

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
        // Local enum mirrors Prisma value-for-value; cast at the boundary.
        purpose: input.purpose as unknown as PrismaOtpPurpose,
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

  /**
   * Latest phone a customer submitted for PROFILE_MOBILE verification and never
   * confirmed — backs `pendingMobile` on the profile payload so a re-login can
   * prefill the field instead of asking for the number again.
   *
   * Deliberately ignores `expiresAt`: the challenge is 5 minutes old and long
   * dead by the time the customer returns, and the value is used ONLY to
   * prefill an input. Submitting always issues a fresh OTP.
   */
  async findPendingMobileForCustomer(customerId: string): Promise<string | null> {
    const row = await this.prisma.otpChallenge.findFirst({
      where: {
        customerId,
        purpose: OtpPurpose.PROFILE_MOBILE as unknown as PrismaOtpPurpose,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: { phone: true },
    });
    return row?.phone ?? null;
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
