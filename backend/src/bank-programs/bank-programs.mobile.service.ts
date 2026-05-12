import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BankProgramRepository } from './bank-programs.repository';
import { BankProgramNotFoundException } from '../common/errors/domain.exceptions';
import { MobileBankProgramResponseDto } from './dto/mobile-bank-program.response.dto';

/**
 * Mobile read-only service. Hand-written allowlist mapper (research.md R5).
 * Inactive programs are invisible (FR-030 — return 404, no leakage).
 */
@Injectable()
export class BankProgramsMobileService {
  constructor(private readonly repo: BankProgramRepository) {}

  async listActive(): Promise<MobileBankProgramResponseDto[]> {
    const { rows } = await this.repo.findManyPaged({
      active: true,
      page: 1,
      pageSize: 100,
    });
    return rows.map((r) => this.toMobile(r));
  }

  async getActiveByCode(programCode: string): Promise<MobileBankProgramResponseDto> {
    const program = await this.repo.findByProgramCode(programCode);
    if (!program || !program.active) {
      throw new BankProgramNotFoundException({ programCode });
    }
    return this.toMobile(program);
  }

  private toMobile(
    program: Awaited<ReturnType<BankProgramRepository['findByProgramCode']>>,
  ): MobileBankProgramResponseDto {
    if (!program) throw new Error('unreachable');

    const pricing = program.pricing as { isVariableRate?: boolean; baseRatePercent?: string; currentEffectiveRatePercent?: string; spreadMinPercent?: string; spreadMaxPercent?: string };
    const loanLimits = program.loanLimits as { perCurrency: Record<string, { minAmount: string; maxAmount: string }> };
    const eligibility = program.eligibility as { acceptedEmploymentTypes: string[]; acceptedLoanPurposes: string[]; ageMin: number; ageMax: number };
    const fees = program.fees as { adminFeeDisplay?: string; adminFeePercent: string; lifeInsuranceMandatory: boolean; stampDutyPercent: string };

    const baseRate = pricing?.isVariableRate ? pricing?.currentEffectiveRatePercent : pricing?.baseRatePercent;
    const minRate = pricing?.spreadMinPercent ?? baseRate ?? '0';
    const maxRate = pricing?.spreadMaxPercent ?? baseRate ?? '0';

    const egp = loanLimits.perCurrency['EGP'] ?? { minAmount: '0', maxAmount: '0' };

    return {
      programCode: program.programCode,
      friendlyName: program.friendlyName,
      bankName: program.bankName,
      productCategory: program.productCategory,
      currencies: program.currencies,
      displayRateRange: {
        minPercent: minRate,
        maxPercent: maxRate,
      },
      displayMinEGP: egp.minAmount,
      displayMaxEGP: egp.maxAmount,
      displayMinMonths: (program.tenor as { minMonths: number }).minMonths,
      displayMaxMonths: (program.tenor as { maxMonths: number }).maxMonths,
      requiredDocuments: program.requiredDocuments,
      adminFeeDisplay: fees.adminFeeDisplay ?? `${new Prisma.Decimal(fees.adminFeePercent).toString()}%`,
      lifeInsuranceMandatory: fees.lifeInsuranceMandatory,
      stampDutyDisplay: `${new Prisma.Decimal(fees.stampDutyPercent).toString()}%`,
      acceptedEmploymentTypes: eligibility.acceptedEmploymentTypes,
      acceptedLoanPurposes: eligibility.acceptedLoanPurposes,
      ageRangeDisplay: `${eligibility.ageMin}–${eligibility.ageMax}`,
    };
  }
}
