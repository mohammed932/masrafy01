import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

export const NATIONAL_ID_FRONT = 'NATIONAL_ID_FRONT';
export const NATIONAL_ID_BACK = 'NATIONAL_ID_BACK';

export interface CustomerIdDocRow {
  id: string;
  documentType: string;
  status: string;
}

/**
 * customer-auth-local read access to the `document` table for the profile-
 * completeness gate (Principle XXXVII) and the National ID validation in the
 * profile-completion service.
 *
 * This repository deliberately queries Prisma directly (Principle X carve-out
 * for a customer-auth-local concern) instead of importing `DocumentsModule` —
 * `DocumentsModule` imports `CustomerAuthModule`, so the reverse import would
 * create a cycle.
 */
@Injectable()
export class CustomerProfileDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Non-erased National ID documents owned by the customer. */
  async findIdDocuments(
    customerId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CustomerIdDocRow[]> {
    const client = tx ?? this.prisma;
    return client.document.findMany({
      where: {
        customerId,
        documentType: { in: [NATIONAL_ID_FRONT, NATIONAL_ID_BACK] },
        erasedAt: null,
      },
      select: { id: true, documentType: true, status: true },
    });
  }
}

/** A National ID side counts as present once it is uploaded/verified (not rejected/pending). */
export function hasUsableIdDoc(docs: CustomerIdDocRow[], documentType: string): boolean {
  return docs.some((d) => d.documentType === documentType && (d.status === 'uploaded' || d.status === 'verified'));
}
