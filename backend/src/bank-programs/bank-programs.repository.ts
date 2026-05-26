import { Injectable } from '@nestjs/common';
import { BankProgram, Prisma, type BankProgramType } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';

/**
 * Bank-program persistence boundary. Services NEVER touch Prisma directly (Principle X).
 *
 * Spec anchors:
 *   FR-012  — programCode unique
 *   FR-014  — paginated list with filters + search
 *   FR-016  — bilingual case-insensitive search (Postgres tsvector + GIN)
 *   FR-019  — programCode immutable; service ignores it on update
 *   FR-020  — edits NEVER mutate downstream offers (matching feature handles snapshot-on-match)
 *   FR-021  — optimistic version compare-and-swap on every persisted save
 *   FR-027  — count referencing BankOffer rows before delete (matching-feature dependency)
 *
 * Research:
 *   R1   — JSONB blobs for sub-configs, hydrate strings → Decimal at edges (decimal stays string in JSONB)
 *   R14  — version field on every save: `update({ where: { id, version }, data: { ..., version: { increment: 1 } } })`
 *           returns zero rows on mismatch → throw CONFLICT_STALE_DATA at the service layer
 */

export type BankProgramCreate = Omit<
  Prisma.BankProgramCreateInput,
  'createdByStaff' | 'updatedByStaff' | 'auditEvents' | 'version' | 'bank'
> & {
  createdBy: string;
  updatedBy: string;
  bankId?: string | null;
};

export type BankProgramUpdate = Omit<
  Prisma.BankProgramUncheckedUpdateInput,
  | 'programCode'
  | 'auditEvents'
  | 'version'
  | 'createdAt'
  | 'updatedAt'
  | 'createdBy'
>;

export interface ListFilters {
  search?: string;
  bankName?: string;
  active?: boolean;
  productCategory?: string;
  acceptedEmploymentType?: string;
  page: number;
  pageSize: number;
}

export interface PagedBankPrograms {
  rows: BankProgram[];
  totalCount: number;
}

@Injectable()
export class BankProgramRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Reads ---------------------------------------------------------------

  async findById(id: string): Promise<BankProgram | null> {
    return this.prisma.bankProgram.findUnique({ where: { id } });
  }

  async findByProgramCode(programCode: string): Promise<BankProgram | null> {
    return this.prisma.bankProgram.findUnique({ where: { programCode } });
  }

  async findManyPaged(filters: ListFilters): Promise<PagedBankPrograms> {
    const where: Prisma.BankProgramWhereInput = {
      ...(filters.bankName
        ? { bankName: { contains: filters.bankName, mode: 'insensitive' } }
        : {}),
      ...(filters.active !== undefined ? { active: filters.active } : {}),
      ...(filters.productCategory ? { productCategory: filters.productCategory } : {}),
      ...(filters.acceptedEmploymentType
        ? {
            eligibility: {
              path: ['acceptedEmploymentTypes'],
              array_contains: filters.acceptedEmploymentType,
            } as Prisma.JsonFilter,
          }
        : {}),
    };

    if (filters.search && filters.search.trim().length > 0) {
      // tsvector @@ to_tsquery with prefix matching via :*
      const term = filters.search
        .trim()
        .replace(/[:&|!()]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .join(' & ');
      if (term.length > 0) {
        const matches: Array<{ id: string }> = await this.prisma.$queryRaw(
          Prisma.sql`SELECT id FROM "bank_program" WHERE "searchVector" @@ to_tsquery('simple', ${term + ':*'})`,
        );
        where.id = { in: matches.map((m) => m.id) };
      }
    }

    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.bankProgram.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.bankProgram.count({ where }),
    ]);
    return { rows, totalCount };
  }

  /**
   * Return all active programs (used by matching engine).
   * No pagination — the engine needs the full set.
   */
  async findAllActive(): Promise<Array<BankProgram & { bank: { isFeatured: boolean } | null }>> {
    return this.prisma.bankProgram.findMany({
      where: { active: true },
      orderBy: { updatedAt: 'desc' },
      include: { bank: { select: { isFeatured: true } } },
    });
  }

  // --- Writes --------------------------------------------------------------

  async create(input: BankProgramCreate, tx?: Prisma.TransactionClient): Promise<BankProgram> {
    const client = tx ?? this.prisma;
    return client.bankProgram.create({
      data: {
        programCode: input.programCode,
        bankName: input.bankName,
        bankId: (input as { bankId?: string }).bankId ?? null,
        friendlyName: input.friendlyName,
        friendlyNameAr: input.friendlyNameAr ?? null,
        programType: input.programType as BankProgramType,
        productCategory: input.productCategory,
        currencies: input.currencies as Prisma.BankProgramCreateInput['currencies'],
        active: input.active ?? true,
        isShariaCompliant: (input as { isShariaCompliant?: boolean }).isShariaCompliant ?? false,
        operatorNotes: input.operatorNotes ?? null,
        operatorTips: (input.operatorTips ?? []) as Prisma.BankProgramCreateInput['operatorTips'],
        requiredDocuments: (input.requiredDocuments ??
          []) as Prisma.BankProgramCreateInput['requiredDocuments'],
        tenor: input.tenor as Prisma.InputJsonValue,
        loanLimits: input.loanLimits as Prisma.InputJsonValue,
        pricing: input.pricing as Prisma.InputJsonValue,
        eligibility: input.eligibility as Prisma.InputJsonValue,
        performanceCriteria: (input.performanceCriteria ??
          Prisma.JsonNull) as Prisma.InputJsonValue,
        incomeAssumption: input.incomeAssumption as Prisma.InputJsonValue,
        fees: input.fees as Prisma.InputJsonValue,
        createdBy: input.createdBy,
        updatedBy: input.updatedBy,
        version: 1,
      },
    });
  }

  /**
   * Optimistic compare-and-swap update. Returns null on version mismatch (the
   * service then throws CONFLICT_STALE_DATA with the persisted version).
   */
  async updateWithVersion(
    id: string,
    submittedVersion: number,
    data: BankProgramUpdate,
    updatedBy: string,
  ): Promise<BankProgram | null> {
    try {
      return await this.prisma.bankProgram.update({
        where: { id, version: submittedVersion },
        data: {
          ...data,
          updatedBy,
          version: { increment: 1 },
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return null;
      }
      throw err;
    }
  }

  async toggleWithVersion(
    id: string,
    submittedVersion: number,
    active: boolean,
    updatedBy: string,
  ): Promise<BankProgram | null> {
    try {
      return await this.prisma.bankProgram.update({
        where: { id, version: submittedVersion },
        data: {
          active,
          updatedBy,
          version: { increment: 1 },
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return null;
      }
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    await this.prisma.bankProgram.delete({ where: { id } });
  }

  /**
   * Count BankOffer rows referencing this program. The BankOffer model is owned
   * by the future matching feature; this method returns 0 until that model exists.
   * Implemented defensively so the FR-027 guard reads as `count > 0 → refuse`.
   */
  async countOffersReferencing(_programCode: string): Promise<number> {
    // Future: when the matching feature introduces `bank_offer`, query it here.
    // For now: zero offers exist, so delete is always permitted.
    return 0;
  }
}
