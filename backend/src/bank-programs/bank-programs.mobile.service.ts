import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { BankProgramRepository } from './bank-programs.repository';
import { BankProgramNotFoundException } from '../common/errors/domain.exceptions';
import { MobileBankProgramResponseDto } from './dto/mobile-bank-program.response.dto';
import { PlatformEnumerationsRepository } from '@/platform-enumerations/platform-enumerations.repository';
import { catalogTenorOf } from '@/matching/pipeline/income-rule-inherit';
import type { CatalogIncomeRules } from '@/matching/pipeline/income-rule-inherit';
import { effectiveTenor } from '@/matching/pipeline/tenor-inherit';
import type { StoredTenor } from '@/matching/pipeline/tenor-inherit';

/**
 * Mobile read-only service. Hand-written allowlist mapper (research.md R5).
 * Inactive programs are invisible (FR-030 — return 404, no leakage).
 */
@Injectable()
export class BankProgramsMobileService {
  constructor(
    private readonly repo: BankProgramRepository,
    /**
     * Read for ONE thing: the surrogate product's default loan duration, for a program that
     * states none of its own.
     *
     * This service maps rows straight from the repository rather than through
     * `toBankProgramSnapshot`, which is where every other read path resolves the same
     * inheritance — so without this a program reading the product's months would publish
     * `displayMinMonths: undefined` to the app, on the one screen whose whole job is telling
     * a customer what the programme offers.
     */
    private readonly enums: PlatformEnumerationsRepository,
  ) {}

  async listActive(): Promise<MobileBankProgramResponseDto[]> {
    const [{ rows }, catalogRules] = await Promise.all([
      this.repo.findManyPaged({ active: true, page: 1, pageSize: 100 }),
      this.enums.programNameIncomeRules(),
    ]);
    // ONE read for the whole page, handed to each row — the same shape the snapshot mapper's
    // callers use, and for the same reason: this runs in a `.map()` that must not do IO.
    return rows.map((r) => this.toMobile(r, catalogRules));
  }

  async getActiveByCode(programCode: string): Promise<MobileBankProgramResponseDto> {
    const program = await this.repo.findByProgramCode(programCode);
    if (!program || !program.active) {
      throw new BankProgramNotFoundException({ programCode });
    }
    return this.toMobile(program, await this.enums.programNameIncomeRules());
  }

  private toMobile(
    program: Awaited<ReturnType<BankProgramRepository['findByProgramCode']>>,
    catalogRules: CatalogIncomeRules,
  ): MobileBankProgramResponseDto {
    if (!program) throw new Error('unreachable');

    const pricing = program.pricing as {
      isVariableRate?: boolean;
      baseRatePercent?: string;
      currentEffectiveRatePercent?: string;
      spreadMinPercent?: string;
      spreadMaxPercent?: string;
    };
    const loanLimits = program.loanLimits as {
      minAmountEGP?: string;
      maxAmountEGP?: string;
    };
    const eligibility = program.eligibility as {
      acceptedEmploymentTypes: string[];
      ageMin: number;
      ageMax: number;
    };
    const fees = program.fees as {
      adminFeeDisplay?: string;
      adminFeePercent: string;
      lifeInsuranceMandatory: boolean;
      stampDutyPercent: string;
    };

    const tenor = effectiveTenor(
      program.tenor as unknown as StoredTenor | undefined,
      catalogTenorOf(
        program.programNameKey === null ? undefined : catalogRules.get(program.programNameKey),
      ),
    );

    const baseRate = pricing?.isVariableRate
      ? pricing?.currentEffectiveRatePercent
      : pricing?.baseRatePercent;
    const minRate = pricing?.spreadMinPercent ?? baseRate ?? '0';
    const maxRate = pricing?.spreadMaxPercent ?? baseRate ?? '0';

    return {
      programCode: program.programCode,
      friendlyName: program.friendlyName,
      bankName: program.bankName,
      productCategory: program.productCategory,
      isShariaCompliant: program.isShariaCompliant,
      displayRateRange: {
        minPercent: minRate,
        maxPercent: maxRate,
      },
      displayMinEGP: loanLimits.minAmountEGP ?? '0',
      displayMaxEGP: loanLimits.maxAmountEGP ?? '0',
      // Resolved through the product, exactly as the quote path resolves it: a program that
      // states no months of its own publishes the product's, not a blank.
      displayMinMonths: tenor?.minMonths ?? 0,
      displayMaxMonths: tenor?.maxMonths ?? 0,
      requiredDocuments: program.requiredDocuments,
      adminFeeDisplay: fees.adminFeeDisplay ?? `${new Decimal(fees.adminFeePercent).toString()}%`,
      lifeInsuranceMandatory: fees.lifeInsuranceMandatory,
      stampDutyDisplay: `${new Decimal(fees.stampDutyPercent).toString()}%`,
      acceptedEmploymentTypes: eligibility.acceptedEmploymentTypes,
      ageRangeDisplay: `${eligibility.ageMin}–${eligibility.ageMax}`,
    };
  }
}
