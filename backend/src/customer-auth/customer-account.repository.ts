import { Injectable } from '@nestjs/common';
import { Prisma, RegistrationPath } from '@prisma/client';
import type { CustomerAccount } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

/**
 * Sentinel error — raised by repository write methods when a unique constraint
 * is hit on `phone` or `email`. Service layer maps to the appropriate
 * `CustomerPhoneAlreadyRegistered` / `CustomerEmailAlreadyRegistered` domain
 * exception (constitutional carve-out keeps `Prisma.PrismaClientKnownRequestError`
 * out of services).
 */
export class CustomerAccountUniqueConflictError extends Error {
  constructor(public readonly field: 'phone' | 'email') {
    super(`Customer ${field} already registered`);
    this.name = 'CustomerAccountUniqueConflictError';
  }
}

function detectUniqueConflict(err: unknown): CustomerAccountUniqueConflictError | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    const target = (err.meta?.target as string[] | string | undefined) ?? '';
    const involvesEmail = Array.isArray(target)
      ? target.includes('email')
      : String(target).includes('email');
    return new CustomerAccountUniqueConflictError(involvesEmail ? 'email' : 'phone');
  }
  return null;
}

export interface CreateCustomerInput {
  phone: string;
  name: string;
  passwordHash: string;
  email?: string | null;
  locale?: string;
}

export interface CreatePhoneVerifiedCustomerInput {
  phone: string;
  name: string;
  passwordHash: string;
  age: number;
  email?: string | null;
  locale?: string;
}

export interface CreateSocialLiteCustomerInput {
  email?: string | null;
  fullName?: string | null;
  locale?: string;
}

export interface BindMobileInput {
  customerId: string;
  phone: string;
}

export interface UpdatePasswordHashInput {
  customerId: string;
  passwordHash: string;
}

export interface CustomerForLogin {
  id: string;
  /**
   * Feature 008 (Constitution v1.8.0): nullable for SOCIAL customers whose
   * mobile is still pending the Complete-Profile flow. Existing PHONE login
   * paths assume non-null and throw `PASSWORD_NOT_SET` / `CUSTOMER_NOT_FOUND`
   * before dereferencing.
   */
  phone: string | null;
  email: string | null;
  name: string;
  locale: string;
  /**
   * Feature 008 (Constitution v1.8.0): nullable for SOCIAL customers who
   * authenticate via Google / Apple and have no password set.
   */
  passwordHash: string | null;
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
  phone: string | null;
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
    try {
      return await client.customerAccount.create({
        data: {
          phone: input.phone,
          name: input.name,
          passwordHash: input.passwordHash,
          email: input.email ?? null,
          locale: input.locale ?? 'ar-EG',
        },
      });
    } catch (err) {
      const conflict = detectUniqueConflict(err);
      if (conflict) throw conflict;
      throw err;
    }
  }

  /**
   * Feature 008 — PHONE-path two-step signup. Creates a fully-verified
   * customer in one shot (OTP already consumed by the caller, so
   * `mobileVerifiedAt` is set immutably on insert per Principle XIII).
   */
  async createPhoneVerified(
    input: CreatePhoneVerifiedCustomerInput,
    tx?: Prisma.TransactionClient,
  ): Promise<CustomerAccount> {
    const client = tx ?? this.prisma;
    try {
      return await client.customerAccount.create({
        data: {
          registrationPath: RegistrationPath.PHONE,
          phone: input.phone,
          mobileVerifiedAt: new Date(),
          name: input.name,
          email: input.email ?? null,
          locale: input.locale ?? 'ar-EG',
          passwordHash: input.passwordHash,
          age: input.age,
        },
      });
    } catch (err) {
      const conflict = detectUniqueConflict(err);
      if (conflict) throw conflict;
      throw err;
    }
  }

  /**
   * Feature 008 — SOCIAL-path lite signup. Mobile + age + passwordHash all
   * null; filled later via the Complete-Profile mobile binding or the
   * first loan-request popup.
   */
  async createSocialLite(
    input: CreateSocialLiteCustomerInput,
    tx?: Prisma.TransactionClient,
  ): Promise<CustomerAccount> {
    const client = tx ?? this.prisma;
    return client.customerAccount.create({
      data: {
        registrationPath: RegistrationPath.SOCIAL,
        phone: null,
        mobileVerifiedAt: null,
        name: input.fullName?.trim() ?? '',
        email: input.email?.toLowerCase().trim() ?? null,
        locale: input.locale ?? 'ar-EG',
        passwordHash: null,
        age: null,
      },
    });
  }

  /**
   * Feature 008 — SOCIAL Complete-Profile binding. Persists the OTP-verified
   * phone and stamps `mobileVerifiedAt` (immutable from this point).
   */
  async bindMobileVerified(input: BindMobileInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    try {
      await client.customerAccount.update({
        where: { id: input.customerId },
        data: { phone: input.phone, mobileVerifiedAt: new Date() },
      });
    } catch (err) {
      const conflict = detectUniqueConflict(err);
      if (conflict) throw conflict;
      throw err;
    }
  }

  async updatePasswordHash(
    input: UpdatePasswordHashInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.customerAccount.update({
      where: { id: input.customerId },
      data: { passwordHash: input.passwordHash },
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
