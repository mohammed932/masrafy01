/**
 * SavedOffer repository — thin Prisma data-access layer.
 * Constitution Principle X: services NEVER touch Prisma directly.
 *
 * Owns reads of the related BankOffer + its parent Application (for the loan
 * category). BankOffer queries live here because this feature owns the
 * customer ↔ offer link; the BankOffer table itself stays immutable.
 */

import { Injectable } from '@nestjs/common';
import { Prisma, type LoanCategory } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../infra/prisma/prisma.service';

/** Joined projection returned to the service for list rendering. */
export interface SavedOfferRow {
  bankOfferId: string;
  savedAt: Date;
  loanCategory: LoanCategory | null;
  approvalScore: number;
  /** No ACTIVE weight set at match time — render "not rated", not 0%. */
  approvalUsedDefault: boolean;
  effectiveTenorMonths: number;
  effectiveRatePercent: Decimal;
  monthlyInstallmentEGP: Decimal;
  effectiveLoanAmountEGP: Decimal;
  bankName: string;
  programFriendlyName: string;
}

/** Ownership guard projection for the save flow. */
export interface SavedOfferTargetSnapshot {
  bankOfferId: string;
  erasedAt: Date | null;
  applicantUserId: string;
}

@Injectable()
export class SavedOfferRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** A customer's saved offers, newest first, joined to the BankOffer + the
   *  parent Application's category. Skips offers erased after saving. */
  async listForCustomer(customerId: string): Promise<SavedOfferRow[]> {
    const rows = await this.prisma.savedOffer.findMany({
      where: { customerId, bankOffer: { erasedAt: null } },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        bankOffer: {
          select: {
            id: true,
            approvalScore: true,
            approvalUsedDefault: true,
            effectiveTenorMonths: true,
            effectiveRatePercent: true,
            monthlyInstallmentEGP: true,
            effectiveLoanAmountEGP: true,
            bankName: true,
            programFriendlyName: true,
            application: { select: { category: true } },
          },
        },
      },
    });

    return rows.map((r) => ({
      bankOfferId: r.bankOffer.id,
      savedAt: r.createdAt,
      loanCategory: r.bankOffer.application.category,
      approvalScore: r.bankOffer.approvalScore,
      approvalUsedDefault: r.bankOffer.approvalUsedDefault,
      effectiveTenorMonths: r.bankOffer.effectiveTenorMonths,
      effectiveRatePercent: r.bankOffer.effectiveRatePercent,
      monthlyInstallmentEGP: r.bankOffer.monthlyInstallmentEGP,
      effectiveLoanAmountEGP: r.bankOffer.effectiveLoanAmountEGP,
      bankName: r.bankOffer.bankName,
      programFriendlyName: r.bankOffer.programFriendlyName,
    }));
  }

  /** The set of bankOfferIds the customer has saved — for projecting an
   *  `isSaved` flag onto offer payloads (apply results / applications list).
   *  A lean id-only read; membership is all the caller needs. */
  async findSavedBankOfferIds(customerId: string): Promise<Set<string>> {
    const rows = await this.prisma.savedOffer.findMany({
      where: { customerId },
      select: { bankOfferId: true },
    });
    return new Set(rows.map((r) => r.bankOfferId));
  }

  /** Resolve a BankOffer for the save guard — exists, not erased, and which
   *  customer owns its application. Returns null when the offer is unknown. */
  async findOfferTarget(
    bankOfferId: string,
  ): Promise<SavedOfferTargetSnapshot | null> {
    const row = await this.prisma.bankOffer.findUnique({
      where: { id: bankOfferId },
      select: {
        id: true,
        erasedAt: true,
        application: { select: { applicantUserId: true } },
      },
    });
    if (!row) return null;
    return {
      bankOfferId: row.id,
      erasedAt: row.erasedAt,
      applicantUserId: row.application.applicantUserId,
    };
  }

  /** Idempotent save — re-saving an already-saved offer is a no-op (the
   *  unique (customerId, bankOfferId) pair guards duplicates). */
  async save(customerId: string, bankOfferId: string): Promise<void> {
    await this.prisma.savedOffer.upsert({
      where: { idx_saved_offer_customer_offer: { customerId, bankOfferId } },
      create: { customerId, bankOfferId },
      update: {},
    });
  }

  /** Unsave; returns the number of rows removed (0 ⇒ it wasn't saved). */
  async remove(customerId: string, bankOfferId: string): Promise<number> {
    const result = await this.prisma.savedOffer.deleteMany({
      where: { customerId, bankOfferId },
    });
    return result.count;
  }
}
