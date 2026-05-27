import { Injectable } from '@nestjs/common';
import type { AuditEvent, LeadStatus } from '@prisma/client';
import { HmacClientUnknownException, NotFoundException } from '@/common/errors/domain.exceptions';
import { CustomerTimelineRepository } from './customer-timeline.repository';

export interface CustomerTimelineMilestone {
  code: string;
  occurredAt: string;
  localizedLabelCode: string;
  outcome?: 'approved' | 'rejected' | 'needs_more_info' | 'conditional' | 'counter_offer';
}

export interface CustomerTimelineResponse {
  applicationId: string;
  milestones: CustomerTimelineMilestone[];
}

const STATUS_TO_MILESTONE: Record<LeadStatus, string> = {
  needs_first_contact: 'MILESTONE_NEEDS_FIRST_CONTACT',
  document_collection: 'MILESTONE_DOCUMENT_COLLECTION',
  ready_for_submission: 'MILESTONE_READY_FOR_SUBMISSION',
  submitted_to_bank: 'MILESTONE_SUBMITTED_TO_BANK',
  bank_decided: 'MILESTONE_BANK_DECIDED',
};

const STATUS_TO_LABEL: Record<LeadStatus, string> = {
  needs_first_contact: 'milestone.needs_first_contact',
  document_collection: 'milestone.document_collection',
  ready_for_submission: 'milestone.ready_for_submission',
  submitted_to_bank: 'milestone.submitted_to_bank',
  bank_decided: 'milestone.bank_decided',
};

@Injectable()
export class CustomerTimelineService {
  constructor(private readonly repo: CustomerTimelineRepository) {}

  async buildTimeline(
    applicationId: string,
    mobileClientId: string,
  ): Promise<CustomerTimelineResponse> {
    const application = await this.repo.findApplicationHeader(applicationId);
    if (!application) throw new NotFoundException();
    if (application.mobileClientId !== mobileClientId) {
      throw new HmacClientUnknownException(mobileClientId);
    }

    const transitions = await this.repo.findLeadStatusTransitions(applicationId);

    const milestones: CustomerTimelineMilestone[] = [];

    milestones.push({
      code: 'MILESTONE_NEEDS_FIRST_CONTACT',
      occurredAt: application.createdAt.toISOString(),
      localizedLabelCode: STATUS_TO_LABEL.needs_first_contact,
    });

    for (const tx of transitions) {
      const payload = (tx.payload ?? {}) as {
        toLeadStatus?: LeadStatus;
      };
      if (!payload.toLeadStatus) continue;
      const code = STATUS_TO_MILESTONE[payload.toLeadStatus];
      const labelCode = STATUS_TO_LABEL[payload.toLeadStatus];
      if (!code) continue;
      milestones.push({
        code,
        occurredAt: tx.occurredAt.toISOString(),
        localizedLabelCode: labelCode,
      });
    }

    const last = milestones[milestones.length - 1];
    if (last?.code === 'MILESTONE_BANK_DECIDED') {
      const bankResponse = await this.repo.findLatestBankResponseActivity(applicationId);
      if (bankResponse) {
        const outcome = this.mapBankOutcome(bankResponse.reason);
        if (outcome) last.outcome = outcome;
      }
    }

    return { applicationId, milestones };
  }

  private mapBankOutcome(reason: string): CustomerTimelineMilestone['outcome'] | null {
    switch (reason) {
      case 'APPROVED':
        return 'approved';
      case 'REJECTED':
        return 'rejected';
      case 'NEEDS_MORE_INFO':
        return 'needs_more_info';
      case 'CONDITIONAL_APPROVAL':
        return 'conditional';
      case 'COUNTER_OFFER':
        return 'counter_offer';
      default:
        return null;
    }
  }
}

export type _AuditEventShape = AuditEvent;
