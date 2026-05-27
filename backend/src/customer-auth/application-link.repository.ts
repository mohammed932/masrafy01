/**
 * ApplicationLink repository — customer-auth-specific Prisma access for the
 * guest-application claim flow.
 *
 * Constitution Principle X (A5): services NEVER touch Prisma directly. This
 * repo lives in the customer-auth feature because the claim flow is a
 * customer-auth concern (linking pre-signup mobile-client applications to a
 * newly authenticated customer). It avoids a circular module dependency
 * between ApplicationsModule and CustomerAuthModule.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

export interface ClaimableApplicationsQuery {
  mobileClientId: string;
  since: Date;
  limit?: number;
}

@Injectable()
export class ApplicationLinkRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the most-recent guest application IDs created by the given
   * `mobileClientId` since the cutoff. Used by the claim flow to discover
   * which rows to re-parent to the newly authenticated customer.
   */
  async findClaimableGuestApplicationIds(
    query: ClaimableApplicationsQuery,
    tx?: Prisma.TransactionClient,
  ): Promise<string[]> {
    const client = tx ?? this.prisma;
    const rows = await client.application.findMany({
      where: {
        mobileClientId: query.mobileClientId,
        applicantUserId: null,
        isGuest: true,
        createdAt: { gte: query.since },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 10,
    });
    return rows.map((r) => r.id);
  }

  /**
   * Re-parents the given application IDs to a customer, clearing the guest
   * flag. Returns the count actually updated (Prisma's `count` from
   * updateMany).
   */
  async claimApplicationsForCustomer(
    args: {
      applicationIds: readonly string[];
      customerId: string;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<{ count: number }> {
    const client = tx ?? this.prisma;
    if (args.applicationIds.length === 0) return { count: 0 };
    const result = await client.application.updateMany({
      where: { id: { in: [...args.applicationIds] } },
      data: { applicantUserId: args.customerId, isGuest: false },
    });
    return { count: result.count };
  }
}
