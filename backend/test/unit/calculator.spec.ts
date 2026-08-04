/**
 * Calculator — the reverse-annuity contract.
 *
 * The reference is the internal reverse calculator sheet:
 *
 *   room   = salary × DBR% ÷ 100 − obligations
 *   maxPV  = room × (1 − (1+r)⁻ⁿ) ÷ r          r = APR ÷ 100 ÷ 12
 *
 * These tests pin BOTH ends: the magnitude of the answer, and the identity that
 * paying that installment for that many months really does amortise it.
 */

import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { ConfigService } from '@nestjs/config';
import { CalculatorService } from '../../src/calculator/calculator.service';
import { calculateMonthlyInstallment } from '../../src/matching/pipeline/pmt';
import { DomainException } from '../../src/common/errors/domain.exceptions';
import type { BankProgramRepository } from '../../src/bank-programs/bank-programs.repository';
import type {
  AffordabilityQuoteResponseDto,
  CalculatorQuoteDto,
  CostQuoteResponseDto,
} from '../../src/calculator/dto/calculator.dto';

function makeService(ratePercent = '26.0000', findById: unknown = async () => null) {
  return new CalculatorService(
    { findById } as unknown as BankProgramRepository,
    { getOrThrow: () => ratePercent } as unknown as ConfigService,
  );
}

const affordability = (over: Partial<CalculatorQuoteDto> = {}): CalculatorQuoteDto => ({
  mode: 'affordability',
  monthlyIncomeEGP: '100000.00',
  existingObligationsEGP: '40000.00',
  dbrCapPercent: '60.0000',
  tenorMonths: 60,
  age: 35,
  ...over,
});

async function quoteAffordability(
  dto: CalculatorQuoteDto,
  rate = '26.0000',
): Promise<AffordabilityQuoteResponseDto> {
  const result = await makeService(rate).quote(dto);
  return result as AffordabilityQuoteResponseDto;
}

describe('CalculatorService — affordability', () => {
  it('turns 100 000 salary and 40 000 obligations at a 60% cap into ~668 000', async () => {
    const data = await quoteAffordability(affordability());

    // 100 000 × 60% = 60 000 allowance, minus 40 000 already committed.
    expect(data.maxMonthlyInstallmentEGP).toBe('20000.00');
    expect(data.recognisedIncomeEGP).toBe('100000.00');
    expect(data.dbrCapPercent).toBe('60.0000');

    const max = new Decimal(data.maxAffordableAmountEGP);
    expect(max.greaterThan(667000)).toBe(true);
    expect(max.lessThan(669000)).toBe(true);
  });

  it('amortises exactly: PMT(maxLoan, rate, tenor) is the affordable installment', async () => {
    const data = await quoteAffordability(affordability());

    const rebuilt = calculateMonthlyInstallment(
      new Decimal(data.maxAffordableAmountEGP),
      new Decimal(data.effectiveRatePercent),
      data.tenorMonths,
    );
    // Within a penny of the room — the whole point of the inversion.
    expect(rebuilt.minus(data.maxMonthlyInstallmentEGP).abs().lessThan('0.02')).toBe(true);
    expect(data.monthlyInstallmentEGP).toBe(rebuilt.toFixed(2));
  });

  it('matches the reference sheet defaults (30 000 obligations at a 50% cap)', async () => {
    // Same 20 000 of room by a different route, so the same present value.
    const fifty = await quoteAffordability(
      affordability({ existingObligationsEGP: '30000.00', dbrCapPercent: '50.0000' }),
    );
    const sixty = await quoteAffordability(affordability());

    expect(fifty.maxMonthlyInstallmentEGP).toBe('20000.00');
    expect(fifty.maxAffordableAmountEGP).toBe(sixty.maxAffordableAmountEGP);
  });

  it('takes the tenor into account — a longer term carries a bigger loan', async () => {
    const short = await quoteAffordability(affordability({ tenorMonths: 24 }));
    const long = await quoteAffordability(affordability({ tenorMonths: 84 }));

    expect(new Decimal(long.maxAffordableAmountEGP).greaterThan(short.maxAffordableAmountEGP)).toBe(
      true,
    );
    expect(short.tenorMonths).toBe(24);
    expect(long.tenorMonths).toBe(84);
  });

  it('degrades to simple division at a zero rate — no divide-by-zero', async () => {
    const data = await quoteAffordability(affordability(), '0');
    // 20 000 × 60 months, with nothing added for interest.
    expect(data.maxAffordableAmountEGP).toBe('1200000.00');
  });

  it('answers zero, with the cap stated, when obligations consume the allowance', async () => {
    const data = await quoteAffordability(
      affordability({ existingObligationsEGP: '60000.00' }), // exactly the 60% allowance
    );

    expect(data.maxMonthlyInstallmentEGP).toBe('0.00');
    expect(data.maxAffordableAmountEGP).toBe('0.00');
    expect(data.monthlyInstallmentEGP).toBe('0.00');
    expect(data.dbrCapPercent).toBe('60.0000');
  });

  it('defaults the cap to 50% when none is given', async () => {
    const dto = affordability();
    delete dto.dbrCapPercent;
    const data = await quoteAffordability(dto);

    expect(data.dbrCapPercent).toBe('50.0000');
    // 100 000 × 50% − 40 000 = 10 000.
    expect(data.maxMonthlyInstallmentEGP).toBe('10000.00');
  });

  it('flags the rate as representative when no program was chosen', async () => {
    const data = await quoteAffordability(affordability());
    expect(data.isRepresentativeRate).toBe(true);
    expect(data.programCode).toBeUndefined();
    expect(data.disclaimerCode).toBe('INDICATIVE_ESTIMATE_NOT_AN_OFFER');
  });
});

describe('CalculatorService — cost', () => {
  it('prices a requested amount without letting DBR shrink it', async () => {
    const data = (await makeService('24.0000').quote({
      mode: 'cost',
      amountEGP: '300000.00',
      tenorMonths: 60,
    })) as CostQuoteResponseDto;

    expect(data.mode).toBe('cost');
    expect(data.cashToCustomerEGP).toBe('300000.00');
    expect(data.clamped).toEqual({ amount: false, tenor: false });
    expect(data.monthlyInstallmentEGP).toBe(
      calculateMonthlyInstallment(new Decimal('300000'), new Decimal('24'), 60).toFixed(2),
    );
    expect(data.totalPayableEGP).toBe(
      new Decimal(data.monthlyInstallmentEGP).mul(60).toFixed(2),
    );
  });

  it('reports the clamp when the tenor exceeds the generic ceiling', async () => {
    const data = (await makeService().quote({
      mode: 'cost',
      amountEGP: '300000.00',
      tenorMonths: 480,
    })) as CostQuoteResponseDto;

    expect(data.tenorMonths).toBe(360);
    expect(data.clamped.tenor).toBe(true);
  });
});

describe('CalculatorService — input rules', () => {
  it('rejects a caller-supplied DBR cap on a program-scoped quote', async () => {
    const service = makeService('24.0000', async () => ({ id: 'bp_1', active: true }));
    await expect(
      service.quote(affordability({ bankProgramId: 'bp_1' })),
    ).rejects.toBeInstanceOf(DomainException);
  });

  it('404s an unknown program', async () => {
    const dto = affordability({ bankProgramId: 'bp_missing' });
    delete dto.dbrCapPercent;
    await expect(makeService().quote(dto)).rejects.toMatchObject({
      code: 'BANK_PROGRAM_NOT_FOUND',
    });
  });

  it('409s an inactive program', async () => {
    const dto = affordability({ bankProgramId: 'bp_off' });
    delete dto.dbrCapPercent;
    const service = makeService('24.0000', async () => ({
      id: 'bp_off',
      programCode: 'OFF-1',
      active: false,
    }));
    await expect(service.quote(dto)).rejects.toMatchObject({
      code: 'CALCULATOR_PROGRAM_INACTIVE',
    });
  });
});
