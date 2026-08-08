import { Injectable, Logger } from '@nestjs/common';
import cuid from 'cuid';
import type { TransactionClient } from '@/common/transaction/transaction-client';
import {
  DocumentNotFoundException,
  DocumentNotPendingException,
  DocumentOwnershipMismatchException,
  FileTooLargeException,
  FileTypeNotAllowedException,
  NotFoundException,
  UnknownEnumerationKeyException,
  DeprecatedEnumerationKeyException,
} from '@/common/errors/domain.exceptions';
import { ApplicationRepository } from '@/applications/application.repository';
import { PlatformEnumerationsRepository } from '@/platform-enumerations/platform-enumerations.repository';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  type AllowedDocumentMimeType,
} from './document.constants';
import { DocumentsRepository } from './documents.repository';
import { S3StorageClient } from './s3-storage.client';
import { stripPiiFromFilename } from './filename-pii';
import { CustomerAccountRepository } from '@/customer-auth/customer-account.repository';
import {
  NATIONAL_ID_BACK,
  NATIONAL_ID_FRONT,
} from '@/customer-auth/customer-profile-document.repository';
import type { StaffRole } from '@/common/enums/staff-role.enum';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import { AuditEventType } from '@/common/audit/audit-event-types';

/** Admin applicant-documents view — profile photo + National ID sides. */
export interface ApplicantDocumentSide {
  id: string;
  status: string;
  uploadedAt: string;
}
export interface ApplicantDocumentsView {
  profilePhoto: { url: string; expiresAt: string } | null;
  nationalId: {
    front: ApplicantDocumentSide | null;
    back: ApplicantDocumentSide | null;
  };
}

const PROFILE_ID_DOCUMENT_TYPES: readonly string[] = [NATIONAL_ID_FRONT, NATIONAL_ID_BACK];

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
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly s3: S3StorageClient,
    private readonly repo: DocumentsRepository,
    private readonly enumerations: PlatformEnumerationsRepository,
    private readonly applications: ApplicationRepository,
    private readonly customers: CustomerAccountRepository,
    private readonly audit: AuditEventWriter,
  ) {}

  /**
   * Mobile customer flow (PR #4): pre-create the Document row in
   * `pending_upload` so the row exists before the PUT, then flip to
   * `uploaded` once the customer reports the upload finished (the
   * `confirmCustomerUpload` method below verifies via S3 HEAD).
   */
  async requestCustomerUploadUrl(input: {
    applicationId: string;
    documentType: string;
    mimeType: string;
    sizeBytes: number;
    originalFilename: string;
    customer: { id: string };
  }): Promise<{
    documentId: string;
    uploadUrl: string;
    s3Key: string;
    expiresAt: Date;
    maxSizeBytes: number;
  }> {
    if (input.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
      throw new FileTooLargeException(input.sizeBytes);
    }
    if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
      throw new FileTypeNotAllowedException(input.mimeType);
    }
    await this.assertDocumentTypeActive(input.documentType);
    await this.assertCustomerOwnsApplication({
      applicationId: input.applicationId,
      customerId: input.customer.id,
    });

    const documentId = cuid();
    const ext = MIME_TO_EXT[input.mimeType as AllowedDocumentMimeType];
    const s3Key = `applications/${input.applicationId}/customer/${documentId}.${ext}`;
    const { uploadUrl, expiresAt } = await this.s3.getPresignedPutUrl(s3Key, input.mimeType);

    const redactedFilename = stripPiiFromFilename(input.originalFilename, null);
    await this.repo.create({
      id: documentId,
      applicationId: input.applicationId,
      documentType: input.documentType,
      s3Key,
      status: 'pending_upload',
      uploadedByContext: 'user',
      uploadedBySource: 'mobile_app',
      uploadedByStaffId: null,
      uploadedByCustomerId: input.customer.id,
      originalFilename: redactedFilename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    });

    return { documentId, uploadUrl, s3Key, expiresAt, maxSizeBytes: MAX_DOCUMENT_SIZE_BYTES };
  }

  async confirmCustomerUpload(input: {
    documentId: string;
    applicationId: string;
    customer: { id: string };
  }): Promise<{ documentId: string; status: 'uploaded' }> {
    const doc = await this.repo.findById(input.documentId);
    if (!doc) throw new DocumentNotFoundException({ documentId: input.documentId });
    if (doc.applicationId !== input.applicationId) {
      throw new DocumentOwnershipMismatchException();
    }
    if (doc.uploadedByCustomerId !== input.customer.id) {
      throw new DocumentOwnershipMismatchException();
    }
    if (doc.status !== 'pending_upload') {
      throw new DocumentNotPendingException({ documentId: doc.id, status: doc.status });
    }
    await this.assertCustomerOwnsApplication({
      applicationId: input.applicationId,
      customerId: input.customer.id,
    });
    const head = await this.s3.headObject(doc.s3Key);
    if (!head.exists) throw new DocumentNotFoundException({ documentId: doc.id });
    await this.repo.markUploaded(doc.id, head.sizeBytes ?? doc.sizeBytes);
    return { documentId: doc.id, status: 'uploaded' };
  }

  // -------------------------------------------------------------------------
  // Profile-completion uploads (Principle XXXVII) — customer-scoped, no
  // application yet. National ID front/back become Document rows owned by the
  // customer; the profile photo is persisted as `customerAccount.profilePhotoKey`.
  // -------------------------------------------------------------------------

  async requestCustomerProfileDocUploadUrl(input: {
    documentType: string;
    mimeType: string;
    sizeBytes: number;
    originalFilename: string;
    customer: { id: string };
  }): Promise<{
    documentId: string;
    uploadUrl: string;
    s3Key: string;
    expiresAt: Date;
    maxSizeBytes: number;
  }> {
    if (input.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
      throw new FileTooLargeException(input.sizeBytes);
    }
    if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
      throw new FileTypeNotAllowedException(input.mimeType);
    }
    if (!PROFILE_ID_DOCUMENT_TYPES.includes(input.documentType)) {
      throw new FileTypeNotAllowedException(input.documentType);
    }
    await this.assertDocumentTypeActive(input.documentType);

    const documentId = cuid();
    const ext = MIME_TO_EXT[input.mimeType as AllowedDocumentMimeType];
    const s3Key = `customers/${input.customer.id}/id/${documentId}.${ext}`;
    const { uploadUrl, expiresAt } = await this.s3.getPresignedPutUrl(s3Key, input.mimeType);

    const redactedFilename = stripPiiFromFilename(input.originalFilename, null);
    await this.repo.create({
      id: documentId,
      applicationId: null,
      customerId: input.customer.id,
      documentType: input.documentType,
      s3Key,
      status: 'pending_upload',
      uploadedByContext: 'user',
      uploadedBySource: 'mobile_app',
      uploadedByStaffId: null,
      uploadedByCustomerId: input.customer.id,
      originalFilename: redactedFilename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    });

    return { documentId, uploadUrl, s3Key, expiresAt, maxSizeBytes: MAX_DOCUMENT_SIZE_BYTES };
  }

  async confirmCustomerProfileDocUpload(input: {
    documentId: string;
    customer: { id: string };
  }): Promise<{ documentId: string; status: 'uploaded' }> {
    const doc = await this.repo.findById(input.documentId);
    if (!doc) throw new DocumentNotFoundException({ documentId: input.documentId });
    if (doc.customerId !== input.customer.id || doc.applicationId !== null) {
      throw new DocumentOwnershipMismatchException();
    }
    if (doc.status !== 'pending_upload') {
      throw new DocumentNotPendingException({ documentId: doc.id, status: doc.status });
    }
    const head = await this.s3.headObject(doc.s3Key);
    if (!head.exists) throw new DocumentNotFoundException({ documentId: doc.id });
    await this.repo.markUploaded(doc.id, head.sizeBytes ?? doc.sizeBytes);
    return { documentId: doc.id, status: 'uploaded' };
  }

  async requestProfilePhotoUploadUrl(input: {
    mimeType: string;
    sizeBytes: number;
    customer: { id: string };
  }): Promise<{ uploadUrl: string; s3Key: string; expiresAt: Date; maxSizeBytes: number }> {
    if (input.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
      throw new FileTooLargeException(input.sizeBytes);
    }
    if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
      throw new FileTypeNotAllowedException(input.mimeType);
    }
    const ext = MIME_TO_EXT[input.mimeType as AllowedDocumentMimeType];
    const s3Key = `customers/${input.customer.id}/photo/${cuid()}.${ext}`;
    const { uploadUrl, expiresAt } = await this.s3.getPresignedPutUrl(s3Key, input.mimeType);
    return { uploadUrl, s3Key, expiresAt, maxSizeBytes: MAX_DOCUMENT_SIZE_BYTES };
  }

  async confirmProfilePhotoUpload(input: {
    s3Key: string;
    customer: { id: string };
  }): Promise<{ s3Key: string }> {
    // Bind the key to the caller — prevents claiming another customer's object.
    if (!input.s3Key.startsWith(`customers/${input.customer.id}/photo/`)) {
      throw new DocumentOwnershipMismatchException();
    }
    const head = await this.s3.headObject(input.s3Key);
    if (!head.exists) throw new NotFoundException();
    // A profile photo is single-valued: every upload mints a fresh cuid key, so
    // the superseded object must be reaped or the bucket accumulates one orphan
    // per change (PII lingering past its purpose — Principle VI).
    const previousKey = await this.customers.findProfilePhotoKey(input.customer.id);
    await this.customers.setProfilePhotoKey({
      customerId: input.customer.id,
      profilePhotoKey: input.s3Key,
    });
    if (previousKey && previousKey !== input.s3Key) {
      // Best-effort: the pointer already moved, so a failed delete leaves an
      // orphan object but must not fail the customer's upload.
      try {
        await this.s3.deleteObject(previousKey);
      } catch (err) {
        this.logger.warn(
          `Failed to delete superseded profile photo object: ${(err as Error).message}`,
        );
      }
    }
    return { s3Key: input.s3Key };
  }

  private async assertDocumentTypeActive(documentType: string): Promise<void> {
    const isActive = await this.enumerations.isActiveMember('required_document', documentType);
    if (isActive) return;
    const isDeprecated = await this.enumerations.isDeprecatedMember(
      'required_document',
      documentType,
    );
    if (isDeprecated) {
      throw new DeprecatedEnumerationKeyException({
        enumerationType: 'required_document',
        deprecatedKey: documentType,
      });
    }
    const active = await this.enumerations.getActiveMembers('required_document');
    throw new UnknownEnumerationKeyException({
      enumerationType: 'required_document',
      offendingKey: documentType,
      activeMembers: active.map((m) => m.key),
    });
  }

  private async assertCustomerOwnsApplication(args: {
    applicationId: string;
    customerId: string;
  }): Promise<void> {
    const app = await this.applications.findOwnershipById(args.applicationId);
    if (!app) throw new NotFoundException();
    if (app.applicantUserId !== args.customerId) {
      throw new DocumentOwnershipMismatchException();
    }
  }

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

  // -------------------------------------------------------------------------
  // Admin applicant-documents view (application detail page). Resolves the
  // application's owning customer, then returns the profile photo (presigned,
  // short-TTL) + National ID side metadata. NID images are revealed on demand
  // via `revealApplicantDocument` (audited, Constitution Principle VI).
  // -------------------------------------------------------------------------

  async getApplicantDocuments(
    applicationId: string,
    requester: { role: StaffRole },
  ): Promise<ApplicantDocumentsView> {
    const customerId = await this.resolveApplicationOwner(applicationId);

    // Profile photo is a PII binary — analysts never receive binaries (VI).
    let profilePhoto: ApplicantDocumentsView['profilePhoto'] = null;
    if (requester.role !== 'analyst') {
      const photoKey = await this.customers.findProfilePhotoKey(customerId);
      if (photoKey) {
        const { downloadUrl, expiresAt } = await this.s3.getPresignedGetUrl(photoKey);
        profilePhoto = { url: downloadUrl, expiresAt: expiresAt.toISOString() };
      }
    }

    const idDocs = await this.repo.findIdDocumentsByCustomer(customerId);
    const pickSide = (documentType: string): ApplicantDocumentSide | null => {
      // `idDocs` is newest-first; the first usable row per side wins.
      const doc = idDocs.find(
        (d) => d.documentType === documentType && d.status !== 'pending_upload',
      );
      return doc
        ? { id: doc.id, status: doc.status, uploadedAt: doc.createdAt.toISOString() }
        : null;
    };

    return {
      profilePhoto,
      nationalId: { front: pickSide(NATIONAL_ID_FRONT), back: pickSide(NATIONAL_ID_BACK) },
    };
  }

  /**
   * Reveal a single applicant National ID image — returns a short-lived
   * presigned URL and writes a CUSTOMER_DOCUMENT_REVEALED audit event
   * (Constitution Principle VI: NID access is audited). Analysts are refused.
   */
  async revealApplicantDocument(input: {
    applicationId: string;
    documentId: string;
    requester: { staffId: string; role: StaffRole };
    sourceIp: string | null;
  }): Promise<{ url: string; expiresAt: string }> {
    if (input.requester.role === 'analyst') {
      // Analysts cannot fetch document binaries (Principle VI + FR-014).
      throw new NotFoundException();
    }
    const customerId = await this.resolveApplicationOwner(input.applicationId);
    const doc = await this.repo.findById(input.documentId);
    if (
      !doc ||
      doc.erasedAt !== null ||
      doc.customerId !== customerId ||
      (doc.documentType !== NATIONAL_ID_FRONT && doc.documentType !== NATIONAL_ID_BACK)
    ) {
      throw new NotFoundException();
    }

    const { downloadUrl, expiresAt } = await this.s3.getPresignedGetUrl(doc.s3Key);
    // `targetId` FKs to StaffAccount — the revealed document goes in the payload,
    // not there. The acting admin is `actorId`.
    await this.audit.write({
      actorId: input.requester.staffId,
      targetId: null,
      eventType: AuditEventType.CUSTOMER_DOCUMENT_REVEALED,
      sourceIp: input.sourceIp,
      payload: {
        documentId: doc.id,
        applicationId: input.applicationId,
        customerId,
        documentType: doc.documentType,
      },
    });
    return { url: downloadUrl, expiresAt: expiresAt.toISOString() };
  }

  private async resolveApplicationOwner(applicationId: string): Promise<string> {
    const app = await this.applications.findOwnershipById(applicationId);
    if (!app) throw new NotFoundException();
    return app.applicantUserId;
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
    tx: TransactionClient;
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
