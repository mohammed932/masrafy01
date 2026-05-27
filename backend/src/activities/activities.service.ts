import { Injectable } from '@nestjs/common';
import cuid from 'cuid';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import { BankProgramRepository } from '@/bank-programs/bank-programs.repository';
import { ApplicationRepository } from '@/applications/application.repository';
import { deriveLeadStatusTransition } from '@/applications/adapters/lead-status-transition.adapter';
import {
  ActivityForbiddenNotAssignedException,
  DurationRequiredForCallException,
  FollowupInPastException,
  InvalidActivityReasonException,
  NotFoundException,
  ReasonDetailsRequiredException,
} from '@/common/errors/domain.exceptions';
import { DocumentsService } from '@/documents/documents.service';
import { stripPiiFromFilename } from '@/documents/filename-pii';
import { ActivitiesRepository } from './activities.repository';
import { ACTIVITY_REASONS, validateActivityReason } from './activity-reasons';
import type {
  AttachedDocumentPayloadDto,
  CreateActivityRequestDto,
} from './dto/create-activity.request.dto';
import type { ActivityActorRole } from './activities.types';
import {
  ACTIVITY_TYPES_ALLOWING_ATTACHMENTS,
  FOLLOWUP_MAX_DAYS_AHEAD,
  SYSTEM_ONLY_ACTIVITY_TYPES,
} from './activities.types';

export interface CreateActivityInput {
  applicationId: string;
  request: CreateActivityRequestDto;
  actor: {
    staffId: string;
    role: ActivityActorRole;
  };
  correlationId: string;
  sourceIp: string | null;
}

export interface CreateActivityOutput {
  activityId: string;
  correlationId: string;
  newLeadStatus: string | null;
  previousLeadStatus: string | null;
}

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ActivitiesRepository,
    private readonly applications: ApplicationRepository,
    private readonly documents: DocumentsService,
    private readonly bankPrograms: BankProgramRepository,
    private readonly audit: AuditEventWriter,
  ) {}

  async createActivity(input: CreateActivityInput): Promise<CreateActivityOutput> {
    const { applicationId, request, actor, correlationId, sourceIp } = input;

    if ((SYSTEM_ONLY_ACTIVITY_TYPES as readonly string[]).includes(request.activityType)) {
      if (actor.role !== 'system') {
        throw new InvalidActivityReasonException({
          activityType: request.activityType,
          reason: request.reason,
          allowedReasons: [],
        });
      }
    }

    const application = await this.applications.findById(applicationId);
    if (!application) throw new NotFoundException();

    if (actor.role === 'sales_agent') {
      if (application.assignedAgentStaffId !== actor.staffId) {
        throw new ActivityForbiddenNotAssignedException(applicationId);
      }
    }

    if (request.activityType === 'CALLED_USER') {
      if (!request.durationMinutes || request.durationMinutes <= 0) {
        throw new DurationRequiredForCallException();
      }
    }

    if (request.reason === 'OTHER' && !request.note?.trim()) {
      throw new ReasonDetailsRequiredException();
    }

    if (request.followUpAt) {
      const followUp = new Date(request.followUpAt);
      const now = Date.now();
      if (followUp.getTime() <= now) throw new FollowupInPastException(request.followUpAt);
      const maxAhead = now + FOLLOWUP_MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000;
      if (followUp.getTime() > maxAhead) {
        throw new FollowupInPastException(request.followUpAt);
      }
    }

    let dynamicReasons: readonly string[] | undefined;
    if (request.activityType === 'SUBMITTED_TO_BANK') {
      const activePrograms = await this.bankPrograms.findAllActive();
      dynamicReasons = activePrograms.map((p) => p.programCode);
    }
    const reasonCheck = validateActivityReason(
      request.activityType as keyof typeof ACTIVITY_REASONS,
      request.reason,
      dynamicReasons,
    );
    if (!reasonCheck.valid) {
      throw new InvalidActivityReasonException({
        activityType: request.activityType,
        reason: request.reason,
        allowedReasons: reasonCheck.allowedReasons,
      });
    }

    const attachments = request.attachedDocuments ?? [];
    if (attachments.length > 0) {
      if (!ACTIVITY_TYPES_ALLOWING_ATTACHMENTS.includes(request.activityType as never)) {
        throw new InvalidActivityReasonException({
          activityType: request.activityType,
          reason: request.reason,
          allowedReasons: reasonCheck.allowedReasons,
        });
      }
    }

    const activityId = cuid();
    const applicantName = this.extractApplicantName(application.applicantProfile);

    return this.prisma.$transaction(
      async (tx) => {
        const persistedDocs = [];
        for (const att of attachments) {
          const doc = await this.documents.persistAfterUpload({
            documentId: att.documentId,
            applicationId,
            documentType: att.documentType,
            s3Key: att.s3Key,
            uploadedBySource: att.uploadedBySource,
            uploadedByContext: 'agent_on_behalf',
            uploadedByStaffId: actor.role === 'system' ? null : actor.staffId,
            originalFilename: att.originalFilename,
            applicantName,
            mimeType: att.mimeType,
            sizeBytes: att.sizeBytes,
            tx,
          });
          persistedDocs.push(doc);
        }

        const sanitizedNote = request.note?.trim()
          ? stripPiiFromFilename(request.note.trim(), applicantName)
          : null;

        await this.repo.create(
          {
            id: activityId,
            applicationId,
            actorStaffId: actor.staffId,
            actorRole: actor.role,
            activityType: request.activityType,
            reason: request.reason,
            note: sanitizedNote,
            durationMinutes: request.durationMinutes ?? null,
            outcomeFlags: request.outcomeFlags ?? [],
            followUpAt: request.followUpAt ? new Date(request.followUpAt) : null,
            attachedDocumentIds: persistedDocs.map((d) => d.id),
            meta: (request.meta as Prisma.InputJsonValue) ?? null,
            correlationId,
          },
          tx,
        );

        const previousLeadStatus = application.leadStatus;
        const newLeadStatus = deriveLeadStatusTransition(application.leadStatus, {
          activityType: request.activityType,
          reason: request.reason,
          actorRole: actor.role,
        });

        if (newLeadStatus !== null) {
          await tx.application.update({
            where: { id: applicationId },
            data: { leadStatus: newLeadStatus },
          });
        }

        await this.audit.write(
          {
            actorId: actor.role === 'system' ? null : actor.staffId,
            targetId: null,
            eventType: AuditEventType.APPLICATION_ACTIVITY_LOGGED,
            sourceIp,
            correlationId,
            payload: {
              applicationId,
              activityId,
              activityType: request.activityType,
              reason: request.reason,
              hasAttachments: attachments.length > 0,
              hasFollowUp: Boolean(request.followUpAt),
              followUpAt: request.followUpAt ?? null,
              actorRole: actor.role,
            },
          },
          tx,
        );

        for (const doc of persistedDocs) {
          await this.audit.write(
            {
              actorId: actor.role === 'system' ? null : actor.staffId,
              targetId: null,
              eventType: AuditEventType.DOCUMENT_UPLOADED,
              sourceIp,
              correlationId,
              payload: {
                applicationId,
                activityId,
                documentId: doc.id,
                documentType: doc.documentType,
                uploadedBySource: doc.uploadedBySource,
                sizeBytes: doc.sizeBytes,
                mimeType: doc.mimeType,
              },
            },
            tx,
          );
        }

        if (newLeadStatus !== null) {
          await this.audit.write(
            {
              actorId: actor.role === 'system' ? null : actor.staffId,
              targetId: null,
              eventType: AuditEventType.APPLICATION_LEAD_STATUS_CHANGED,
              sourceIp,
              correlationId,
              payload: {
                applicationId,
                activityId,
                fromLeadStatus: previousLeadStatus,
                toLeadStatus: newLeadStatus,
              },
            },
            tx,
          );
        }

        return {
          activityId,
          correlationId,
          newLeadStatus,
          previousLeadStatus,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async listForApplication(
    applicationId: string,
    actor: { role: ActivityActorRole | 'analyst' },
    opts: { cursor?: string; limit?: number } = {},
  ) {
    const application = await this.applications.findById(applicationId);
    if (!application) throw new NotFoundException();
    const rows = await this.repo.findManyByApplication(applicationId, opts);
    return rows.map((row) => this.projectActivity(row, actor));
  }

  private projectActivity(
    row: Awaited<ReturnType<ActivitiesRepository['findById']>> & object,
    actor: { role: ActivityActorRole | 'analyst' },
  ) {
    const isAnalyst = actor.role === 'analyst';
    return {
      id: row.id,
      applicationId: row.applicationId,
      actorStaffId: isAnalyst ? null : row.actorStaffId,
      actorRole: row.actorRole,
      activityType: row.activityType,
      reason: row.reason,
      note: isAnalyst ? null : row.note,
      durationMinutes: row.durationMinutes,
      outcomeFlags: row.outcomeFlags,
      followUpAt: row.followUpAt?.toISOString() ?? null,
      attachedDocumentIds: isAnalyst ? [] : row.attachedDocumentIds,
      meta: row.meta,
      correlationId: row.correlationId,
      occurredAt: row.occurredAt.toISOString(),
    };
  }

  private extractApplicantName(profile: unknown): string | null {
    if (!profile || typeof profile !== 'object') return null;
    const p = profile as Record<string, unknown>;
    const first = typeof p.firstName === 'string' ? p.firstName : '';
    const last = typeof p.lastName === 'string' ? p.lastName : '';
    const full = `${first} ${last}`.trim();
    return full.length > 0 ? full : null;
  }
}
