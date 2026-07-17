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
import {
  QuestionnaireService,
  type ApplicantQuestionnaireView,
} from '@/questionnaire/questionnaire.service';

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
    private readonly questionnaire: QuestionnaireService,
  ) {}

  /**
   * The applicant's real questionnaire responses (question → chosen answer),
   * resolved to labels from the frozen version snapshot. Returns null for
   * legacy applications with no dynamic questionnaire (pre-Feature 009). This is
   * the authoritative "collected from the user" data — the `applicantProfile`
   * blob is a derived offer-math approximation and is not shown as answers.
   */
  async buildApplicantQuestionnaire(
    row: NonNullable<Awaited<ReturnType<ApplicationRepository['findById']>>>,
  ): Promise<ApplicantQuestionnaireView | null> {
    if (!row.category || row.dynamicAnswers.length === 0) {
      return null;
    }
    return this.questionnaire.buildAnswersView(
      { versionId: row.questionnaireVersionId, category: row.category },
      row.dynamicAnswers.map((a) => ({
        questionCode: a.questionCode,
        selectedOptionCode: a.selectedOptionCode,
      })),
    );
  }

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
