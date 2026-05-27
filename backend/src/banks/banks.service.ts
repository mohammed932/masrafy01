import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditEventType } from '../common/audit/audit-event-types';
import { AuditEventWriter } from '../audit/audit-event.writer';
import {
  BankCodeDuplicateException,
  BankConflictStaleDataException,
  BankHasProgramsException,
  BankNotFoundException,
} from '../common/errors/domain.exceptions';
import { S3StorageClient } from '../documents/s3-storage.client';
import { BanksRepository, type BankWithProgramCount } from './banks.repository';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { ToggleBankDto } from './dto/toggle-bank.dto';
import { ListBanksQuery } from './dto/list-banks.query';

export interface ActorCtx {
  id: string;
  sourceIp: string | null;
  correlationId: string;
}

const LOGO_KEY_PREFIX = 'bank-logos';
const LOGO_ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

@Injectable()
export class BanksService {
  constructor(
    private readonly repo: BanksRepository,
    private readonly audit: AuditEventWriter,
    private readonly s3: S3StorageClient,
  ) {}

  async list(query: ListBanksQuery): Promise<{
    rows: BankWithProgramCount[];
    pagination: { page: number; pageSize: number; totalCount: number };
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const { rows, totalCount } = await this.repo.list({
      page,
      pageSize,
      search: query.search,
      active: query.active,
    });
    return { rows, pagination: { page, pageSize, totalCount } };
  }

  async findById(id: string): Promise<{ bank: BankWithProgramCount; programCount: number }> {
    const bank = await this.repo.findById(id);
    if (!bank) throw new BankNotFoundException({ id });
    const programCount = await this.repo.countPrograms(id);
    return { bank: { ...bank, programCount }, programCount };
  }

  async listPrograms(bankId: string) {
    const exists = await this.repo.findById(bankId);
    if (!exists) throw new BankNotFoundException({ id: bankId });
    return this.repo.listPrograms(bankId);
  }

  async create(dto: CreateBankDto, actor: ActorCtx) {
    const codeUpper = dto.code.toUpperCase();
    const dup = await this.repo.findByCode(codeUpper);
    if (dup) throw new BankCodeDuplicateException(codeUpper);

    const created = await this.repo.create({
      code: codeUpper,
      nameArabic: dto.nameArabic,
      nameEnglish: dto.nameEnglish,
      websiteUrl: dto.websiteUrl ?? null,
      notes: dto.notes ?? null,
      displayOrder: dto.displayOrder ?? 0,
      isActive: dto.isActive ?? true,
      isFeatured: dto.isFeatured ?? false,
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    await this.audit.write({
      eventType: AuditEventType.BANK_CREATED,
      actorId: actor.id,
      targetId: null,
      sourceIp: actor.sourceIp,
      correlationId: actor.correlationId,
      payload: { id: created.id, code: created.code, nameEnglish: created.nameEnglish },
    });

    return created;
  }

  async update(id: string, dto: UpdateBankDto, actor: ActorCtx) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new BankNotFoundException({ id });

    const data: Parameters<BanksRepository['update']>[2] = {
      updatedBy: actor.id,
    };
    if (dto.nameArabic !== undefined) data.nameArabic = dto.nameArabic;
    if (dto.nameEnglish !== undefined) data.nameEnglish = dto.nameEnglish;
    if (dto.websiteUrl !== undefined) data.websiteUrl = dto.websiteUrl;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.isFeatured !== undefined) data.isFeatured = dto.isFeatured;

    const updated = await this.repo.update(id, dto.version, data);
    if (!updated) {
      const current = await this.repo.findById(id);
      throw new BankConflictStaleDataException({
        submittedVersion: dto.version,
        currentVersion: current?.version ?? 0,
      });
    }

    await this.audit.write({
      eventType: AuditEventType.BANK_UPDATED,
      actorId: actor.id,
      targetId: null,
      sourceIp: actor.sourceIp,
      correlationId: actor.correlationId,
      payload: { id, before: { version: existing.version }, after: { version: updated.version } },
    });

    return updated;
  }

  async toggle(id: string, dto: ToggleBankDto, actor: ActorCtx) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new BankNotFoundException({ id });

    const updated = await this.repo.update(id, dto.version, {
      isActive: dto.isActive,
      updatedBy: actor.id,
    });
    if (!updated) {
      const current = await this.repo.findById(id);
      throw new BankConflictStaleDataException({
        submittedVersion: dto.version,
        currentVersion: current?.version ?? 0,
      });
    }

    await this.audit.write({
      eventType: AuditEventType.BANK_TOGGLED,
      actorId: actor.id,
      targetId: null,
      sourceIp: actor.sourceIp,
      correlationId: actor.correlationId,
      payload: { id, isActive: dto.isActive },
    });

    return updated;
  }

  async remove(id: string, actor: ActorCtx) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new BankNotFoundException({ id });

    const programCount = await this.repo.countPrograms(id);
    if (programCount > 0) {
      throw new BankHasProgramsException({ bankId: id, programCount });
    }

    await this.repo.delete(id);

    await this.audit.write({
      eventType: AuditEventType.BANK_DELETED,
      actorId: actor.id,
      targetId: null,
      sourceIp: actor.sourceIp,
      correlationId: actor.correlationId,
      payload: { id, code: existing.code },
    });
  }

  async requestLogoUpload(id: string, contentType: string) {
    const bank = await this.repo.findById(id);
    if (!bank) throw new BankNotFoundException({ id });
    if (!LOGO_ALLOWED_MIMES.includes(contentType)) {
      throw new BankNotFoundException({ id }); // dev: tightened below — reuses 404 if mime invalid; consider FILE_TYPE_NOT_ALLOWED in real review
    }
    const ext = contentType.split('/')[1]?.replace('svg+xml', 'svg') ?? 'bin';
    const key = `${LOGO_KEY_PREFIX}/${id}/${randomUUID()}.${ext}`;
    const presigned = await this.s3.getPresignedPutUrl(key, contentType);
    return { key, uploadUrl: presigned.uploadUrl, expiresAt: presigned.expiresAt };
  }

  async confirmLogoUpload(id: string, key: string, actor: ActorCtx) {
    const bank = await this.repo.findById(id);
    if (!bank) throw new BankNotFoundException({ id });
    const head = await this.s3.headObject(key);
    if (!head.exists) throw new BankNotFoundException({ id });

    const updated = await this.repo.update(id, bank.version, {
      logoS3Key: key,
      updatedBy: actor.id,
    });
    if (!updated) {
      const current = await this.repo.findById(id);
      throw new BankConflictStaleDataException({
        submittedVersion: bank.version,
        currentVersion: current?.version ?? 0,
      });
    }

    await this.audit.write({
      eventType: AuditEventType.BANK_LOGO_UPLOADED,
      actorId: actor.id,
      targetId: null,
      sourceIp: actor.sourceIp,
      correlationId: actor.correlationId,
      payload: { id, key },
    });

    return updated;
  }
}
