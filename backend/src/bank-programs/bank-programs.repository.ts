import { Injectable } from '@nestjs/common';
import { BankProgram, Prisma, type BankProgramType } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';

/**
 * Domain JSON value type exposed to services / DTOs. Accepts any JSON-serializable
 * object (class instance or plain), array, or scalar. The repository casts to
 * Prisma's `InputJsonValue` at the boundary (Constitution Principle X / A8).
 */
export type JsonBlob = object | unknown[] | string | number | boolean | null;

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

/**
 * Domain create input — kept free of Prisma types so services do not have to
 * import `@prisma/client` to call `create()`. The repository casts each JSON
 * field at the Prisma boundary below.
 */
export interface BankProgramCreate {
  programCode: string;
  bankName: string;
  bankId?: string | null;
  friendlyName: string;
  friendlyNameAr?: string | null;
  programNameKey: string;
  programType: string;
  productCategory: string;
  currencies: readonly string[];
  active?: boolean;
  isShariaCompliant?: boolean;
  operatorNotes?: string | null;
  operatorTips?: readonly string[];
  requiredDocuments?: readonly string[];
  tenor: JsonBlob;
  loanLimits: JsonBlob;
  pricing: JsonBlob;
  eligibility: JsonBlob;
  performanceCriteria?: JsonBlob;
  incomeAssumption: JsonBlob;
  fees: JsonBlob;
  /** Feature 011 — sparse dot-path → 'team_estimated'; absent path = bank-stated. */
  valueSources?: JsonBlob;
  createdBy: string;
  updatedBy: string;
}

/** Domain update input — same Prisma-free posture as `BankProgramCreate`. */
export interface BankProgramUpdate {
  bankName?: string;
  bankId?: string | null;
  friendlyName?: string;
  friendlyNameAr?: string | null;
  programNameKey?: string;
  programType?: string;
  productCategory?: string;
  currencies?: readonly string[];
  active?: boolean;
  isShariaCompliant?: boolean;
  operatorNotes?: string | null;
  operatorTips?: readonly string[];
  requiredDocuments?: readonly string[];
  tenor?: JsonBlob;
  loanLimits?: JsonBlob;
  pricing?: JsonBlob;
  eligibility?: JsonBlob;
  performanceCriteria?: JsonBlob;
  incomeAssumption?: JsonBlob;
  fees?: JsonBlob;
  valueSources?: JsonBlob;
}

export interface ListFilters {
  search?: string;
  bankName?: string;
  active?: boolean;
  productCategory?: string;
  programNameKey?: string;
  isShariaCompliant?: boolean;
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
      ...(filters.programNameKey ? { programNameKey: filters.programNameKey } : {}),
      ...(filters.isShariaCompliant !== undefined
        ? { isShariaCompliant: filters.isShariaCompliant }
        : {}),
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
   * Feature 011 / FR-036 — programs carrying at least one team-estimated number,
   * with the audit timestamp of their OLDEST still-standing marker.
   *
   * Two reads rather than a join, because the two questions are different shapes: the
   * programs come from a JSONB emptiness test, and `waitingSince` comes from the
   * append-only audit trail, where the relevant event is the EARLIEST
   * `BANK_PROGRAM_VALUE_SOURCE_CHANGED` that added a path still present today. A
   * marker removed and re-added should read as waiting since the RE-add, which is why
   * the payload's `added` array is matched rather than just taking the first event.
   *
   * `valueSources <> '{}'` is the filter, not `IS NOT NULL`: the column is non-null
   * with a `{}` default, so every pre-existing program is excluded by construction —
   * which is exactly FR-037 (they stay live and never appear here).
   */
  async findPendingBankConfirmation(args: {
    page: number;
    pageSize: number;
  }): Promise<{ rows: BankProgram[]; totalCount: number }> {
    const where: Prisma.BankProgramWhereInput = {
      NOT: { valueSources: { equals: {} } },
    };
    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.bankProgram.findMany({
        where,
        // Oldest-updated first: the list is a work queue, and the program that has
        // been waiting longest is the one to chase.
        orderBy: { updatedAt: 'asc' },
        skip: (args.page - 1) * args.pageSize,
        take: args.pageSize,
      }),
      this.prisma.bankProgram.count({ where }),
    ]);
    return { rows, totalCount };
  }

  /**
   * The marker-change events for these programs, oldest first.
   *
   * Returned raw so the service can decide which event a still-standing path came
   * from — a decision that needs the CURRENT map, which this layer does not interpret
   * (Principle X: the repository fetches, the service reasons).
   */
  async findValueSourceEvents(
    bankProgramIds: readonly string[],
  ): Promise<Array<{ bankProgramId: string | null; occurredAt: Date; payload: unknown }>> {
    if (bankProgramIds.length === 0) return [];
    return this.prisma.auditEvent.findMany({
      where: {
        bankProgramId: { in: [...bankProgramIds] },
        eventType: 'BANK_PROGRAM_VALUE_SOURCE_CHANGED',
      },
      orderBy: { occurredAt: 'asc' },
      select: { bankProgramId: true, occurredAt: true, payload: true },
    });
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
        bankId: input.bankId ?? null,
        friendlyName: input.friendlyName,
        friendlyNameAr: input.friendlyNameAr ?? null,
        programNameKey: input.programNameKey,
        programType: input.programType as BankProgramType,
        productCategory: input.productCategory,
        currencies: [...input.currencies] as Prisma.BankProgramCreateInput['currencies'],
        active: input.active ?? true,
        isShariaCompliant: input.isShariaCompliant ?? false,
        operatorNotes: input.operatorNotes ?? null,
        operatorTips: [
          ...(input.operatorTips ?? []),
        ] as Prisma.BankProgramCreateInput['operatorTips'],
        requiredDocuments: [
          ...(input.requiredDocuments ?? []),
        ] as Prisma.BankProgramCreateInput['requiredDocuments'],
        tenor: input.tenor as unknown as Prisma.InputJsonValue,
        loanLimits: input.loanLimits as unknown as Prisma.InputJsonValue,
        pricing: input.pricing as unknown as Prisma.InputJsonValue,
        eligibility: input.eligibility as unknown as Prisma.InputJsonValue,
        performanceCriteria: (input.performanceCriteria ??
          Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        incomeAssumption: input.incomeAssumption as unknown as Prisma.InputJsonValue,
        fees: input.fees as unknown as Prisma.InputJsonValue,
        // `?? {}` rather than leaving it to the column default: a create that sends
        // no markers means "nothing estimated", and being explicit keeps the row's
        // shape identical whether it came through the API or a seed.
        valueSources: (input.valueSources ?? {}) as unknown as Prisma.InputJsonValue,
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
    const prismaData: Prisma.BankProgramUncheckedUpdateInput = {
      updatedBy,
      version: { increment: 1 },
    };
    if (data.bankName !== undefined) prismaData.bankName = data.bankName;
    if (data.bankId !== undefined) prismaData.bankId = data.bankId;
    if (data.friendlyName !== undefined) prismaData.friendlyName = data.friendlyName;
    if (data.friendlyNameAr !== undefined) prismaData.friendlyNameAr = data.friendlyNameAr;
    if (data.programNameKey !== undefined) prismaData.programNameKey = data.programNameKey;
    if (data.programType !== undefined) {
      prismaData.programType = data.programType as BankProgramType;
    }
    if (data.productCategory !== undefined) prismaData.productCategory = data.productCategory;
    if (data.currencies !== undefined) {
      prismaData.currencies = [...data.currencies] as Prisma.BankProgramUpdateInput['currencies'];
    }
    if (data.active !== undefined) prismaData.active = data.active;
    if (data.isShariaCompliant !== undefined) prismaData.isShariaCompliant = data.isShariaCompliant;
    if (data.operatorNotes !== undefined) prismaData.operatorNotes = data.operatorNotes;
    if (data.operatorTips !== undefined) {
      prismaData.operatorTips = [
        ...data.operatorTips,
      ] as Prisma.BankProgramUpdateInput['operatorTips'];
    }
    if (data.requiredDocuments !== undefined) {
      prismaData.requiredDocuments = [
        ...data.requiredDocuments,
      ] as Prisma.BankProgramUpdateInput['requiredDocuments'];
    }
    if (data.tenor !== undefined) prismaData.tenor = data.tenor as unknown as Prisma.InputJsonValue;
    if (data.loanLimits !== undefined) {
      prismaData.loanLimits = data.loanLimits as unknown as Prisma.InputJsonValue;
    }
    if (data.pricing !== undefined) {
      prismaData.pricing = data.pricing as unknown as Prisma.InputJsonValue;
    }
    if (data.eligibility !== undefined) {
      prismaData.eligibility = data.eligibility as unknown as Prisma.InputJsonValue;
    }
    if (data.performanceCriteria !== undefined) {
      prismaData.performanceCriteria = (data.performanceCriteria ??
        Prisma.JsonNull) as unknown as Prisma.InputJsonValue;
    }
    if (data.incomeAssumption !== undefined) {
      prismaData.incomeAssumption = data.incomeAssumption as unknown as Prisma.InputJsonValue;
    }
    if (data.fees !== undefined) prismaData.fees = data.fees as unknown as Prisma.InputJsonValue;
    if (data.valueSources !== undefined) {
      prismaData.valueSources = data.valueSources as unknown as Prisma.InputJsonValue;
    }

    try {
      return await this.prisma.bankProgram.update({
        where: { id, version: submittedVersion },
        data: prismaData,
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
