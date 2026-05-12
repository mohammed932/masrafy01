import { Injectable } from '@nestjs/common';
import { AttemptOutcome, type Prisma, type SignInAttempt } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

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
        outcome: input.outcome,
        sourceIp: input.sourceIp,
        userAgent: input.userAgent ?? null,
        correlationId: input.correlationId,
      },
    });
  }
}
