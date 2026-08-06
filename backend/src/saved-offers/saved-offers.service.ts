/**
 * Saved Offers service — customer bookmarking of matched BankOffers.
 * Principle X: depends only on the repository, never on Prisma directly.
 * Principle I / A3: totals computed in Decimal, emitted as strings.
 */
import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import {
  BankOfferNotFoundException,
  ForbiddenException,
  SavedOfferNotFoundException,
} from '@/common/errors/domain.exceptions';
import {
  SavedOfferRepository,
  type SavedOfferRow,
} from './saved-offer.repository';
import type { SavedOfferListItem } from './dto/saved-offer.dto';

@Injectable()
export class SavedOffersService {
  constructor(private readonly repo: SavedOfferRepository) {}

  /** The caller's saved offers, newest first, projected for the mobile card. */
  async list(customerId: string): Promise<SavedOfferListItem[]> {
    const rows = await this.repo.listForCustomer(customerId);
    return rows.map((r) => this.project(r));
  }

  /**
   * Save (bookmark) a matched offer. Idempotent. The offer must exist, not be
   * erased, and belong to one of the caller's own applications.
   *
   * (Built for completeness — the mobile UI does not call this yet.)
   */
  async save(customerId: string, bankOfferId: string): Promise<void> {
    const target = await this.repo.findOfferTarget(bankOfferId);
    if (!target || target.erasedAt) {
      throw new BankOfferNotFoundException({ bankOfferId });
    }
    if (target.applicantUserId !== customerId) {
      throw new ForbiddenException();
    }
    await this.repo.save(customerId, bankOfferId);
  }

  /** Unsave. Throws SAVED_OFFER_NOT_FOUND when the offer wasn't saved. */
  async remove(customerId: string, bankOfferId: string): Promise<void> {
    const removed = await this.repo.remove(customerId, bankOfferId);
    if (removed === 0) {
      throw new SavedOfferNotFoundException({ bankOfferId });
    }
  }

  private project(r: SavedOfferRow): SavedOfferListItem {
    const totalRepayable = r.monthlyInstallmentEGP.mul(r.effectiveTenorMonths);
    const totalInterest = totalRepayable.sub(r.effectiveLoanAmountEGP);
    return {
      bankOfferId: r.bankOfferId,
      loanTypeKey: r.loanCategory ?? 'personal',
      approvalScore: r.approvalScore,
      approvalUsedDefault: r.approvalUsedDefault,
      effectiveTenorMonths: r.effectiveTenorMonths,
      effectiveRatePercent: r.effectiveRatePercent.toFixed(4),
      monthlyInstallmentEGP: r.monthlyInstallmentEGP.toFixed(2),
      effectiveLoanAmountEGP: r.effectiveLoanAmountEGP.toFixed(2),
      totalRepayableEGP: totalRepayable.toFixed(2),
      totalInterestEGP: totalInterest.toFixed(2),
      totalLabel: compactEGP(totalRepayable),
      bankName: r.bankName,
      programFriendlyName: r.programFriendlyName,
      savedAt: r.savedAt.toISOString(),
    };
  }
}

/** 170320 → "170K", 1_650_000 → "1.7M". Display-only. */
function compactEGP(value: Decimal): string {
  const n = value.toNumber();
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}
