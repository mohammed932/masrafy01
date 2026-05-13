import { Injectable } from '@nestjs/common';
import cuid from 'cuid';
import type { Prisma } from '@prisma/client';
import {
  FileTooLargeException,
  FileTypeNotAllowedException,
  NotFoundException,
  UnknownEnumerationKeyException,
  DeprecatedEnumerationKeyException,
} from '@/common/errors/domain.exceptions';
import { PlatformEnumerationsRepository } from '@/platform-enumerations/platform-enumerations.repository';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  type AllowedDocumentMimeType,
} from '@/activities/activities.types';
import { DocumentsRepository } from './documents.repository';
import { S3StorageClient } from './s3-storage.client';
import { stripPiiFromFilename } from './filename-pii';
import type { StaffRole } from '@prisma/client';

export interface RequestUploadUrlInput {
  applicationId: string;
  documentType: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string;
  uploadedBySource: 'whatsapp' | 'email' | 'in_person' | 'mobile_app' | 'courier' | 'other';
  actor: { staffId: string; role: StaffRole };
}

export interface RequestUploadUrlOutput {
  documentId: string;
  uploadUrl: string;
  s3Key: string;
  expiresAt: Date;
  maxSizeBytes: number;
}

const MIME_TO_EXT: Record<AllowedDocumentMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly s3: S3StorageClient,
    private readonly repo: DocumentsRepository,
    private readonly enumerations: PlatformEnumerationsRepository,
  ) {}

  async requestUploadUrl(input: RequestUploadUrlInput): Promise<RequestUploadUrlOutput> {
    if (input.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
      throw new FileTooLargeException(input.sizeBytes);
    }
    if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
      throw new FileTypeNotAllowedException(input.mimeType);
    }
    const isActive = await this.enumerations.isActiveMember(
      'required_document',
      input.documentType,
    );
    if (!isActive) {
      const isDeprecated = await this.enumerations.isDeprecatedMember(
        'required_document',
        input.documentType,
      );
      if (isDeprecated) {
        throw new DeprecatedEnumerationKeyException({
          enumerationType: 'required_document',
          deprecatedKey: input.documentType,
        });
      }
      const active = await this.enumerations.getActiveMembers('required_document');
      throw new UnknownEnumerationKeyException({
        enumerationType: 'required_document',
        offendingKey: input.documentType,
        activeMembers: active.map((m) => m.key),
      });
    }

    const documentId = cuid();
    const ext = MIME_TO_EXT[input.mimeType as AllowedDocumentMimeType];
    const s3Key = `applications/${input.applicationId}/${documentId}.${ext}`;
    const { uploadUrl, expiresAt } = await this.s3.getPresignedPutUrl(s3Key, input.mimeType);
    return { documentId, uploadUrl, s3Key, expiresAt, maxSizeBytes: MAX_DOCUMENT_SIZE_BYTES };
  }

  async getDownloadUrl(
    documentId: string,
    requester: { staffId: string; role: StaffRole },
  ): Promise<{ downloadUrl: string; expiresAt: Date }> {
    const doc = await this.repo.findById(documentId);
    if (!doc || doc.erasedAt !== null) throw new NotFoundException();
    if (requester.role === 'analyst') {
      // Analysts cannot fetch document binaries (Principle VI + FR-014).
      throw new NotFoundException();
    }
    return this.s3.getPresignedGetUrl(doc.s3Key);
  }

  async listForApplication(applicationId: string) {
    return this.repo.findManyByApplication(applicationId);
  }

  /**
   * Verifies the S3 object exists then persists the Document row. Used by the
   * activity-create flow (single transaction with the Activity insert).
   */
  async persistAfterUpload(input: {
    documentId: string;
    applicationId: string;
    documentType: string;
    s3Key: string;
    uploadedBySource: 'whatsapp' | 'email' | 'in_person' | 'mobile_app' | 'courier' | 'other';
    uploadedByContext: 'agent_on_behalf' | 'user';
    uploadedByStaffId: string | null;
    originalFilename: string;
    applicantName: string | null;
    mimeType: string;
    sizeBytes: number;
    tx: Prisma.TransactionClient;
  }) {
    const head = await this.s3.headObject(input.s3Key);
    if (!head.exists) throw new NotFoundException();
    const redactedFilename = stripPiiFromFilename(input.originalFilename, input.applicantName);
    return this.repo.create(
      {
        id: input.documentId,
        applicationId: input.applicationId,
        documentType: input.documentType,
        s3Key: input.s3Key,
        status: 'uploaded',
        uploadedByContext: input.uploadedByContext,
        uploadedBySource: input.uploadedBySource,
        uploadedByStaffId: input.uploadedByStaffId,
        originalFilename: redactedFilename,
        mimeType: input.mimeType,
        sizeBytes: head.sizeBytes ?? input.sizeBytes,
      },
      input.tx,
    );
  }
}
