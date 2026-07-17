import { Injectable } from '@nestjs/common';
import type { Document, Prisma } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';
import {
  NATIONAL_ID_BACK,
  NATIONAL_ID_FRONT,
} from '@/customer-auth/customer-profile-document.repository';

export interface CreateDocumentInput {
  id: string;
  applicationId?: string | null;
  customerId?: string | null;
  documentType: string;
  s3Key: string;
  status: 'pending_upload' | 'uploaded' | 'verified' | 'rejected' | 'erased';
  uploadedByContext: 'agent_on_behalf' | 'user';
  uploadedBySource: 'whatsapp' | 'email' | 'in_person' | 'mobile_app' | 'courier' | 'other';
  uploadedByStaffId: string | null;
  uploadedByCustomerId?: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateDocumentInput, tx?: Prisma.TransactionClient): Promise<Document> {
    const client = tx ?? this.prisma;
    return client.document.create({ data: input });
  }

  async findById(id: string): Promise<Document | null> {
    return this.prisma.document.findUnique({ where: { id } });
  }

  async findManyByIdsForApplication(
    ids: readonly string[],
    applicationId: string,
  ): Promise<Document[]> {
    if (ids.length === 0) return [];
    return this.prisma.document.findMany({
      where: { id: { in: [...ids] }, applicationId },
    });
  }

  async findManyByApplication(applicationId: string): Promise<Document[]> {
    return this.prisma.document.findMany({
      where: { applicationId, erasedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Non-erased National ID documents owned by a customer (front/back), for the
   * admin applicant-documents view. NID images are customer-scoped rows
   * (`applicationId` is null, keyed `customers/{id}/id/...`), so they are looked
   * up by `customerId`, not by application.
   */
  async findIdDocumentsByCustomer(
    customerId: string,
  ): Promise<Array<Pick<Document, 'id' | 'documentType' | 'status' | 's3Key' | 'createdAt'>>> {
    return this.prisma.document.findMany({
      where: {
        customerId,
        documentType: { in: [NATIONAL_ID_FRONT, NATIONAL_ID_BACK] },
        erasedAt: null,
      },
      select: { id: true, documentType: true, status: true, s3Key: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markVerified(id: string, verifiedByStaffId: string): Promise<Document> {
    return this.prisma.document.update({
      where: { id },
      data: { status: 'verified', verifiedAt: new Date(), verifiedByStaffId },
    });
  }

  async markRejected(id: string, verifiedByStaffId: string): Promise<Document> {
    return this.prisma.document.update({
      where: { id },
      data: { status: 'rejected', verifiedAt: new Date(), verifiedByStaffId },
    });
  }

  async markErased(id: string, tx?: Prisma.TransactionClient): Promise<Document> {
    const client = tx ?? this.prisma;
    return client.document.update({
      where: { id },
      data: { status: 'erased', erasedAt: new Date() },
    });
  }

  async markUploaded(id: string, sizeBytes: number): Promise<Document> {
    return this.prisma.document.update({
      where: { id },
      data: { status: 'uploaded', sizeBytes },
    });
  }
}
