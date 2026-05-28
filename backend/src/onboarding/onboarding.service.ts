import { Injectable } from '@nestjs/common';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import {
  OnboardingOrderDuplicateException,
  OnboardingScreenNotFoundException,
} from '@/common/errors/domain.exceptions';
import { OnboardingRepository, type OnboardingScreenRow } from './onboarding.repository';
import type {
  CreateOnboardingScreenDto,
  OnboardingScreenResponseDto,
  ReorderOnboardingScreensDto,
  UpdateOnboardingScreenDto,
} from './dto/onboarding.dto';

export interface OnboardingRequestContext {
  sourceIp: string | null;
  correlationId: string;
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly repo: OnboardingRepository,
    private readonly audit: AuditEventWriter,
  ) {}

  async listMobile(): Promise<OnboardingScreenResponseDto[]> {
    const rows = await this.repo.listActive();
    return rows.map((r) => this.toDto(r));
  }

  async listAdmin(): Promise<OnboardingScreenResponseDto[]> {
    const rows = await this.repo.listAll();
    return rows.map((r) => this.toDto(r));
  }

  async create(args: {
    body: CreateOnboardingScreenDto;
    actorStaffId: string;
    ctx: OnboardingRequestContext;
  }): Promise<OnboardingScreenResponseDto> {
    try {
      const row = await this.repo.create({
        order: args.body.order,
        titleAr: args.body.titleAr,
        titleEn: args.body.titleEn,
        bodyAr: args.body.bodyAr,
        bodyEn: args.body.bodyEn,
        imageS3Key: args.body.imageS3Key ?? null,
        updatedBy: args.actorStaffId,
      });
      await this.audit.write({
        actorId: args.actorStaffId,
        targetId: row.id,
        eventType: AuditEventType.ONBOARDING_SCREEN_CREATED,
        sourceIp: args.ctx.sourceIp,
        correlationId: args.ctx.correlationId,
        payload: { onboardingScreenId: row.id, order: row.order },
      });
      return this.toDto(row);
    } catch (err) {
      if (this.repo.isUniqueViolation(err)) {
        throw new OnboardingOrderDuplicateException(args.body.order);
      }
      throw err;
    }
  }

  async update(args: {
    id: string;
    body: UpdateOnboardingScreenDto;
    actorStaffId: string;
    ctx: OnboardingRequestContext;
  }): Promise<OnboardingScreenResponseDto> {
    const existing = await this.repo.findById(args.id);
    if (!existing) throw new OnboardingScreenNotFoundException({ id: args.id });
    const row = await this.repo.update(args.id, {
      titleAr: args.body.titleAr,
      titleEn: args.body.titleEn,
      bodyAr: args.body.bodyAr,
      bodyEn: args.body.bodyEn,
      imageS3Key: args.body.imageS3Key,
      active: args.body.active,
      updatedBy: args.actorStaffId,
    });
    await this.audit.write({
      actorId: args.actorStaffId,
      targetId: row.id,
      eventType: AuditEventType.ONBOARDING_SCREEN_UPDATED,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { onboardingScreenId: row.id, fields: Object.keys(args.body) },
    });
    return this.toDto(row);
  }

  async delete(args: {
    id: string;
    actorStaffId: string;
    ctx: OnboardingRequestContext;
  }): Promise<void> {
    const existing = await this.repo.findById(args.id);
    if (!existing) throw new OnboardingScreenNotFoundException({ id: args.id });
    await this.repo.delete(args.id);
    await this.audit.write({
      actorId: args.actorStaffId,
      targetId: args.id,
      eventType: AuditEventType.ONBOARDING_SCREEN_DELETED,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { onboardingScreenId: args.id, order: existing.order },
    });
  }

  async reorder(args: {
    body: ReorderOnboardingScreensDto;
    actorStaffId: string;
    ctx: OnboardingRequestContext;
  }): Promise<OnboardingScreenResponseDto[]> {
    try {
      const rows = await this.repo.reorder(args.body.items, args.actorStaffId);
      await this.audit.write({
        actorId: args.actorStaffId,
        targetId: null,
        eventType: AuditEventType.ONBOARDING_SCREEN_REORDERED,
        sourceIp: args.ctx.sourceIp,
        correlationId: args.ctx.correlationId,
        payload: { items: args.body.items },
      });
      return rows.map((r) => this.toDto(r));
    } catch (err) {
      if (this.repo.isUniqueViolation(err)) {
        throw new OnboardingOrderDuplicateException(args.body.items[0]?.order ?? -1);
      }
      throw err;
    }
  }

  private toDto(row: OnboardingScreenRow): OnboardingScreenResponseDto {
    return {
      id: row.id,
      order: row.order,
      titleAr: row.titleAr,
      titleEn: row.titleEn,
      bodyAr: row.bodyAr,
      bodyEn: row.bodyEn,
      imageS3Key: row.imageS3Key ?? undefined,
      active: row.active,
    };
  }
}
