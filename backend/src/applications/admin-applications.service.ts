/**
 * Admin-facing application writes. Reads stay in the controller (thin repo
 * passthrough); the lead-status mutation lives here because it pairs a write
 * with an audit event (Principle X — services orchestrate, controllers stay
 * thin).
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../infra/prisma/prisma.service';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { AuditEventType } from '../common/audit/audit-event-types';
import { NotFoundException } from '../common/errors/domain.exceptions';
import { ApplicationRepository } from './application.repository';
import { LeadStatus } from './dto/enums';

interface ActorCtx {
  id: string;
  sourceIp: string | null;
}

@Injectable()
export class AdminApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ApplicationRepository,
    private readonly audit: AuditEventRepository,
  ) {}

  async setLeadStatus(id: string, leadStatus: LeadStatus, actor: ActorCtx): Promise<void> {
    const current = await this.repo.findLeadStatus(id);
    if (!current) throw new NotFoundException();

    // No-op when unchanged — avoids a redundant audit row.
    if (current.leadStatus === leadStatus) return;

    await this.prisma.$transaction(async (tx) => {
      await this.repo.updateLeadStatus(id, leadStatus, tx);
      await this.audit.create(
        {
          actorId: actor.id,
          targetId: null,
          eventType: AuditEventType.APPLICATION_LEAD_STATUS_CHANGED,
          sourceIp: actor.sourceIp,

          payload: {
            applicationId: id,
            from: current.leadStatus,
            to: leadStatus,
          },
        },
        tx,
      );
    });
  }
}
