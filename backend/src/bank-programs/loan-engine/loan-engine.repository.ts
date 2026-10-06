/**
 * Feature 013 — what the Loan Engine reads (Principle X: the service never touches Prisma).
 *
 * Effect writes go through `BankProgramsService.update()` — the same path the bank-program
 * form saves through — so the version compare-and-swap, every table validator and the
 * `BANK_PROGRAM_UPDATED` audit are one implementation, and the Loan Engine and the program
 * form stay two views of one row (research R5). The ONE write here is `conditions`, a
 * column the form does not carry, under the same compare-and-swap.
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

/** One active program, its tables as STORED (not plan-merged — editability needs the raw). */
export interface LoanEngineProgramRow {
  programCode: string;
  bankName: string;
  friendlyName: string;
  category: string;
  version: number;
  plansSource: string | null;
  pricing: unknown;
  loanLimits: unknown;
  tenor: unknown;
  incomeAssumption: unknown;
  programNameKey: string | null;
  conditions: unknown;
}

export interface LoanEngineOptionRow {
  code: string;
  labelAr: string;
  labelEn: string;
}

@Injectable()
export class LoanEngineRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Active programs in these loan types, by code — the matrix rows. */
  async activePrograms(categories: readonly string[]): Promise<LoanEngineProgramRow[]> {
    if (categories.length === 0) return [];
    const rows = await this.prisma.bankProgram.findMany({
      where: { active: true, productCategory: { in: [...categories] } },
      orderBy: [{ productCategory: 'asc' }, { bankName: 'asc' }, { programCode: 'asc' }],
      select: {
        programCode: true,
        bankName: true,
        friendlyName: true,
        productCategory: true,
        version: true,
        plansSource: true,
        pricing: true,
        loanLimits: true,
        tenor: true,
        incomeAssumption: true,
        programNameKey: true,
        conditions: true,
      },
    });
    return rows.map((r) => ({
      programCode: r.programCode,
      bankName: r.bankName,
      friendlyName: r.friendlyName,
      category: r.productCategory,
      version: r.version,
      plansSource: r.plansSource,
      pricing: r.pricing,
      loanLimits: r.loanLimits,
      tenor: r.tenor,
      incomeAssumption: r.incomeAssumption,
      programNameKey: r.programNameKey,
      conditions: r.conditions,
    }));
  }

  /** One program as stored — after a write, to answer with the fresh slice. */
  async programByCode(programCode: string): Promise<LoanEngineProgramRow | null> {
    const r = await this.prisma.bankProgram.findUnique({
      where: { programCode },
      select: {
        programCode: true,
        bankName: true,
        friendlyName: true,
        productCategory: true,
        version: true,
        plansSource: true,
        pricing: true,
        loanLimits: true,
        tenor: true,
        incomeAssumption: true,
        programNameKey: true,
        conditions: true,
      },
    });
    if (r === null) return null;
    return {
      programCode: r.programCode,
      bankName: r.bankName,
      friendlyName: r.friendlyName,
      category: r.productCategory,
      version: r.version,
      plansSource: r.plansSource,
      pricing: r.pricing,
      loanLimits: r.loanLimits,
      tenor: r.tenor,
      incomeAssumption: r.incomeAssumption,
      programNameKey: r.programNameKey,
      conditions: r.conditions,
    };
  }

  /**
   * Replace a program's conditions under the version compare-and-swap every program save
   * uses (FR-021): `null` on a stale version. The program form's `update()` never writes this
   * column, so an edit there cannot drop what the Loan Engine stated.
   */
  async writeConditions(args: {
    programCode: string;
    expectedVersion: number;
    conditions: unknown[];
    updatedBy: string;
  }): Promise<{ id: string; version: number } | null> {
    try {
      return await this.prisma.bankProgram.update({
        where: { programCode: args.programCode, version: args.expectedVersion },
        data: {
          conditions:
            args.conditions.length === 0
              ? Prisma.DbNull
              : (args.conditions as Prisma.InputJsonValue),
          updatedBy: args.updatedBy,
          version: { increment: 1 },
        },
        select: { id: true, version: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') return null;
      throw err;
    }
  }

  /** The question's live options, in the order the applicant sees them. */
  async questionOptions(questionCode: string): Promise<LoanEngineOptionRow[]> {
    return this.prisma.questionOption.findMany({
      where: { isActive: true, question: { code: questionCode } },
      orderBy: { displayOrder: 'asc' },
      select: { code: true, labelAr: true, labelEn: true },
    });
  }

  /** Every live option of these questions, grouped by question, in the applicant's order. */
  async optionsFor(questionCodes: readonly string[]): Promise<Map<string, LoanEngineOptionRow[]>> {
    const byQuestion = new Map<string, LoanEngineOptionRow[]>();
    if (questionCodes.length === 0) return byQuestion;
    const rows = await this.prisma.questionOption.findMany({
      where: { isActive: true, question: { code: { in: [...questionCodes] } } },
      orderBy: { displayOrder: 'asc' },
      select: { code: true, labelAr: true, labelEn: true, question: { select: { code: true } } },
    });
    for (const r of rows) {
      const list = byQuestion.get(r.question.code) ?? [];
      list.push({ code: r.code, labelAr: r.labelAr, labelEn: r.labelEn });
      byQuestion.set(r.question.code, list);
    }
    return byQuestion;
  }
}
