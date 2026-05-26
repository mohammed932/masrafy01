import { Injectable } from '@nestjs/common';
import type { Prisma, CustomerAccount } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

export interface CreateCustomerInput {
  phone: string;
  name: string;
  passwordHash: string;
  email?: string | null;
  locale?: string;
}

export interface CustomerForLogin {
  id: string;
  phone: string;
  email: string | null;
  name: string;
  locale: string;
  passwordHash: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface CustomerListQuery {
  q?: string;
  pageSize: number;
  pageIndex: number;
}

export interface CustomerListRow {
  id: string;
  phone: string;
  email: string | null;
  name: string;
  locale: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  applicationCount: number;
}

@Injectable()
export class CustomerAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPhone(phone: string): Promise<CustomerForLogin | null> {
    return this.prisma.customerAccount.findUnique({
      where: { phone },
      select: this.loginShape(),
    });
  }

  async findByEmail(email: string): Promise<CustomerForLogin | null> {
    return this.prisma.customerAccount.findUnique({
      where: { email },
      select: this.loginShape(),
    });
  }

  async findById(id: string): Promise<CustomerForLogin | null> {
    return this.prisma.customerAccount.findUnique({
      where: { id },
      select: this.loginShape(),
    });
  }

  async create(
    input: CreateCustomerInput,
    tx?: Prisma.TransactionClient,
  ): Promise<CustomerAccount> {
    const client = tx ?? this.prisma;
    return client.customerAccount.create({
      data: {
        phone: input.phone,
        name: input.name,
        passwordHash: input.passwordHash,
        email: input.email ?? null,
        locale: input.locale ?? 'ar-EG',
      },
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.customerAccount.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async list(query: CustomerListQuery): Promise<{
    rows: CustomerListRow[];
    total: number;
  }> {
    const where: Prisma.CustomerAccountWhereInput = query.q
      ? {
          OR: [
            { phone: { contains: query.q } },
            { email: { contains: query.q, mode: 'insensitive' } },
            { name: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customerAccount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.pageIndex * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          phone: true,
          email: true,
          name: true,
          locale: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          lastLoginAt: true,
          _count: { select: { applications: true } },
        },
      }),
      this.prisma.customerAccount.count({ where }),
    ]);

    return {
      total,
      rows: rows.map((r) => ({
        id: r.id,
        phone: r.phone,
        email: r.email,
        name: r.name,
        locale: r.locale,
        isActive: r.isActive,
        isVerified: r.isVerified,
        createdAt: r.createdAt,
        lastLoginAt: r.lastLoginAt,
        applicationCount: r._count.applications,
      })),
    };
  }

  async detail(id: string) {
    return this.prisma.customerAccount.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        locale: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        lastLoginAt: true,
        applications: {
          select: {
            id: true,
            loanPurpose: true,
            status: true,
            leadStatus: true,
            requestedAmountEGP: true,
            createdAt: true,
            userProceededAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        supportRequests: {
          select: {
            id: true,
            channel: true,
            status: true,
            createdAt: true,
            resolvedAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
  }

  private loginShape() {
    return {
      id: true,
      phone: true,
      email: true,
      name: true,
      locale: true,
      passwordHash: true,
      isActive: true,
      isVerified: true,
      createdAt: true,
      lastLoginAt: true,
    } as const;
  }
}
