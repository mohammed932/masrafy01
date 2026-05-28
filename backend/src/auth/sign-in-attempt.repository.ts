import { Injectable } from '@nestjs/common';
import type { Prisma, AttemptOutcome as PrismaAttemptOutcome, SignInAttempt } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { AttemptOutcome } from './dto/enums';

export interface RecordSignInAttemptInput {
  userId: string | null;
  emailAttempted: string;
  outcome: AttemptOutcome;
  sourceIp: string;
  userAgent: string | null;
  correlationId: string;
}

@Injectable()
export class SignInAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    input: RecordSignInAttemptInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SignInAttempt> {
    const client = tx ?? this.prisma;
    return client.signInAttempt.create({
      data: {
        userId: input.userId,
        emailAttempted: input.emailAttempted,
        outcome: input.outcome as unknown as PrismaAttemptOutcome,
        sourceIp: input.sourceIp,
        userAgent: input.userAgent ?? null,
        correlationId: input.correlationId,
      },
    });
  }
}
