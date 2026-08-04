import { Injectable } from '@nestjs/common';
import { Bank, Prisma } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';

export interface ListBanksFilters {
  page: number;
  pageSize: number;
  search?: string;
  active?: boolean;
}

export interface BankWithProgramCount extends Bank {
  programCount: number;
}

@Injectable()
export class BanksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Bank | null> {
    return this.prisma.bank.findUnique({ where: { id } });
  }

  async findByNameEnglish(nameEnglish: string): Promise<Bank | null> {
    return this.prisma.bank.findUnique({ where: { nameEnglish } });
  }

  async list(
    filters: ListBanksFilters,
  ): Promise<{ rows: BankWithProgramCount[]; totalCount: number }> {
    const where: Prisma.BankWhereInput = {
      ...(filters.active !== undefined ? { isActive: filters.active } : {}),
      ...(filters.search
        ? {
            OR: [
              { nameArabic: { contains: filters.search, mode: 'insensitive' } },
              { nameEnglish: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.bank.findMany({
        where,
        orderBy: [{ displayOrder: 'asc' }, { nameEnglish: 'asc' }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        include: { _count: { select: { programs: true } } },
      }),
      this.prisma.bank.count({ where }),
    ]);

    return {
      rows: rows.map((r) => {
        const { _count, ...rest } = r as typeof r & { _count: { programs: number } };
        return { ...rest, programCount: _count.programs };
      }),
      totalCount,
    };
  }

  async create(data: Prisma.BankUncheckedCreateInput): Promise<Bank> {
    return this.prisma.bank.create({ data });
  }

  /**
   * Update with optimistic concurrency. Returns null when version mismatched.
   */
  async update(
    id: string,
    version: number,
    data: Omit<Prisma.BankUncheckedUpdateInput, 'id' | 'version' | 'createdAt' | 'createdBy'>,
  ): Promise<Bank | null> {
    const res = await this.prisma.bank.updateMany({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
    });
    if (res.count === 0) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.bank.delete({ where: { id } });
  }

  async countPrograms(bankId: string): Promise<number> {
    return this.prisma.bankProgram.count({ where: { bankId } });
  }

  /**
   * Programs on a bank's shelf. The JSONB blobs come back whole — the service
   * flattens the handful of headline figures the list renders (rate / ceiling /
   * tenor) so the page needs no per-program detail call.
   */
  async listPrograms(bankId: string) {
    return this.prisma.bankProgram.findMany({
      where: { bankId },
      select: {
        id: true,
        programCode: true,
        friendlyName: true,
        friendlyNameAr: true,
        programNameKey: true,
        productCategory: true,
        active: true,
        isShariaCompliant: true,
        version: true,
        pricing: true,
        loanLimits: true,
        tenor: true,
        updatedAt: true,
      },
      orderBy: [{ productCategory: 'asc' }, { friendlyName: 'asc' }],
    });
  }
}
