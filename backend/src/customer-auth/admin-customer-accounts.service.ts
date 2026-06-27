import { Injectable } from '@nestjs/common';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { CustomerNotFoundException } from '@/common/errors/domain.exceptions';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import { CustomerAccountRepository } from './customer-account.repository';
import { CustomerRefreshTokenRepository } from './customer-refresh-token.repository';

/** Actor + request metadata for an audited admin mutation. */
export interface AdminActionContext {
  actorId: string;
  sourceIp: string | null;
  correlationId: string;
}

export interface CustomerStatusResult {
  id: string;
  isActive: boolean;
}

/**
 * Admin (super_admin) write operations on customer accounts. Read access lives
 * directly in the controller; this service owns the transactional, audited
 * mutations (Principle IX/X — services orchestrate, repositories touch Prisma).
 */
@Injectable()
export class AdminCustomerAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomerAccountRepository,
    private readonly refreshTokens: CustomerRefreshTokenRepository,
    private readonly audit: AuditEventWriter,
  ) {}

  /**
   * Enable/disable a customer account. Deactivating revokes the customer's
   * active refresh tokens (kills live sessions) and is audited. No-ops (and
   * skips the audit) when the account is already in the requested state.
   */
  async setActive(
    id: string,
    isActive: boolean,
    ctx: AdminActionContext,
  ): Promise<CustomerStatusResult> {
    const current = await this.customers.findById(id);
    if (!current) throw new CustomerNotFoundException({ id });

    if (current.isActive === isActive) {
      return { id, isActive };
    }

    await this.prisma.$transaction(async (tx) => {
      await this.customers.setActive({ customerId: id, isActive }, tx);
      if (!isActive) {
        await this.refreshTokens.revokeAllForCustomer(id, tx);
      }
      await this.audit.write(
        {
          actorId: ctx.actorId,
          // AuditEvent.targetId is a StaffAccount FK — customer id rides in the payload.
          targetId: null,
          eventType: isActive
            ? AuditEventType.CUSTOMER_REACTIVATED
            : AuditEventType.CUSTOMER_DEACTIVATED,
          sourceIp: ctx.sourceIp,
          correlationId: ctx.correlationId,
          payload: { customerId: id, isActive },
        },
        tx,
      );
    });

    return { id, isActive };
  }
}
