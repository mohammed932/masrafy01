import { Injectable } from '@nestjs/common';
import { BankProgramType, LoanCategory } from '@prisma/client';
import {
  PlatformEnumerationsRepository,
  type EnumerationMember,
} from '@/platform-enumerations/platform-enumerations.repository';
import { BankProgramRepository } from './bank-programs.repository';
import { matchesRequestedScope } from './program-scope';
import type {
  IncomeTypeOptionDto,
  ProgramNameOptionDto,
  ProgramOptionsResponseDto,
} from './dto/program-options.response.dto';

/**
 * "What can this customer actually pick?" — the read behind the mobile selection
 * wizard's income-type and program-name steps.
 *
 * Derived, never declared. `bank_program.programType` is the single statement of
 * income basis (v16.4.0 deleted the per-catalog-name `payslip`/`noPayslip`
 * booleans precisely so there would be one), and the catalog contributes only the
 * labels and the assignment axis. That means an operator who activates a
 * no-payslip program has widened the customer's choices by doing nothing else,
 * and one who deactivates the last one has narrowed them the same way.
 */

/** Both bases, in the order the customer sees them. Payslip first: it is the common case. */
const INCOME_TYPES: readonly BankProgramType[] = [
  BankProgramType.income_proof,
  BankProgramType.income_surrogate,
];

@Injectable()
export class ProgramOptionsService {
  constructor(
    private readonly programs: BankProgramRepository,
    private readonly enums: PlatformEnumerationsRepository,
  ) {}

  async forCategory(category: LoanCategory): Promise<ProgramOptionsResponseDto> {
    const [rows, members] = await Promise.all([
      this.programs.listActiveScopeRows(),
      this.enums.getActiveMembers('program_name'),
    ]);

    // Only names the catalog still offers under this category. A program can
    // outlive its archetype's assignment, and `ProgramNameScopeService
    // .assertOfferedUnder` would reject such a key at apply — so offering it here
    // would walk the customer into a typed rejection three screens later.
    const offered = new Map<string, EnumerationMember>();
    for (const m of members) {
      if (m.categories.includes(category)) offered.set(m.key, m);
    }

    // (programType → programNameKey → count). Nested rather than a composite key
    // so the per-basis total and the per-name totals come off one pass.
    const counts = new Map<BankProgramType, Map<string, number>>(
      INCOME_TYPES.map((t) => [t, new Map<string, number>()]),
    );

    for (const row of rows) {
      if (!matchesRequestedScope(row, category, null, null)) continue;
      // A program with no `programNameKey` predates the catalog and instantiates
      // no archetype. It cannot be reached by a request that names one, so it must
      // not inflate a count the customer is about to pick from.
      if (row.programNameKey === null) continue;
      if (!offered.has(row.programNameKey)) continue;
      const byName = counts.get(row.programType);
      if (!byName) continue;
      byName.set(row.programNameKey, (byName.get(row.programNameKey) ?? 0) + 1);
    }

    const incomeTypes: IncomeTypeOptionDto[] = INCOME_TYPES.map((programType) => {
      const byName = counts.get(programType) ?? new Map<string, number>();
      const programNames: ProgramNameOptionDto[] = [];
      let programCount = 0;
      // Iterate `offered`, not `byName`: the catalog's own order is what the
      // picker should render, and it is stable across requests.
      for (const [key, member] of offered) {
        const count = byName.get(key);
        if (!count) continue;
        programNames.push({
          key,
          labelAr: member.labelAr,
          labelEn: member.labelEn,
          programCount: count,
        });
        programCount += count;
      }
      return { programType, programCount, programNames };
    });

    return { category, incomeTypes };
  }
}
