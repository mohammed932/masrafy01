import { Injectable } from '@nestjs/common';
import type { LoanCategory } from '@prisma/client';
import {
  ProgramNameKeyNotInCategoryException,
  ProgramNameKeyUnknownException,
} from '@/common/errors/domain.exceptions';
import { PlatformEnumerationsRepository } from './platform-enumerations.repository';

/**
 * "Is this catalog program name a thing a customer may ask for under this loan
 * category?" — the CUSTOMER-side half of the `program_name` registry.
 *
 * Lives here, next to the registry, rather than in either caller: apply and
 * matching-preview both narrow their program set by the same (category,
 * programNameKey) pair, and the two must accept exactly the same pairs or a
 * previewed shortlist would not survive the apply that follows it (A25).
 *
 * Deliberately NOT the same function `BankProgramsService.assertProgramNameKey`
 * uses. That one guards an ADMIN write and carries a grandfather escape hatch
 * (`skipProgramNameCategoryCheck`) so an operator's catalog edit cannot freeze
 * bank programs that already sit on a since-unassigned pair. A customer read has
 * nothing to grandfather — it is asking for a pair right now — so folding the
 * two together would mean either the escape hatch leaks into the customer path
 * or the admin path loses it.
 */
@Injectable()
export class ProgramNameScopeService {
  constructor(private readonly enums: PlatformEnumerationsRepository) {}

  /**
   * Throws unless `programNameKey` is a live catalog name offered under
   * `category`.
   *
   * A DEPRECATED name is rejected through `PROGRAM_NAME_KEY_UNKNOWN` rather than
   * the admin path's dedicated deprecation warning: the customer picker only
   * ever renders active members, so a deprecated key here means a stale app
   * screen, and "pick again from the list" is the only useful instruction.
   * Nothing the customer can do distinguishes the two cases.
   */
  async assertOfferedUnder(programNameKey: string, category: LoanCategory): Promise<void> {
    if (!(await this.enums.isActiveMember('program_name', programNameKey))) {
      const active = await this.enums.getActiveMembers('program_name');
      throw new ProgramNameKeyUnknownException({
        programNameKey,
        activeKeys: active.map((m) => m.key),
      });
    }
    const assigned = await this.enums.memberCategories('program_name', programNameKey);
    if ((assigned as readonly string[]).includes(category)) return;
    throw new ProgramNameKeyNotInCategoryException({
      programNameKey,
      productCategory: category,
      assignedCategories: [...assigned],
    });
  }
}
