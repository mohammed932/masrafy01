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

export interface CreatePhoneVerifiedLiteInput {
  phone: string;
  locale?: string;
}

export interface CreateSocialLiteCustomerInput {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  locale?: string;
}

export interface CompleteProfileInput {
  customerId: string;
  firstName: string;
  lastName: string;
  birthday: Date;
  /** PHONE customers set a password; SOCIAL customers omit it. */
  passwordHash?: string | null;
}

export interface SetProfilePhotoKeyInput {
  customerId: string;
  profilePhotoKey: string;
}

/** Minimal projection used by the profile-completeness gate (Principle XXXVII). */
export interface CustomerProfileState {
  registrationPath: RegistrationPath;
  mobileVerifiedAt: Date | null;
  firstName: string;
  lastName: string;
  birthday: Date | null;
  profilePhotoKey: string | null;
  passwordHash: string | null;
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
  firstName: string;
  lastName: string;
  locale: string;
  /**
   * Feature 008 (Constitution v1.8.0): nullable for SOCIAL customers who
   * authenticate via Google / Apple and have no password set.
   */
  passwordHash: string | null;
  registrationPath: RegistrationPath;
  mobileVerifiedAt: Date | null;
  birthday: Date | null;
  profilePhotoKey: string | null;
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
  firstName: string;
  lastName: string;
  nameSplitNeedsReview: boolean;
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

  /**
   * v4.0.0 — PHONE-path signup. Mobile + OTP already verified by the caller,
   * so the row is created LITE (mobileVerifiedAt stamped, profile empty) and
   * the mandatory profile-completion step fills firstName/lastName/birthday/
   * photo/password later (Principle XXXVII). `mobileVerifiedAt` is immutable
   * from this point (Principle XIII).
   */
  async createPhoneVerifiedLite(
    input: CreatePhoneVerifiedLiteInput,
    tx?: Prisma.TransactionClient,
  ): Promise<CustomerAccount> {
    const client = tx ?? this.prisma;
    try {
      return await client.customerAccount.create({
        data: {
          registrationPath: RegistrationPath.PHONE,
          phone: input.phone,
          mobileVerifiedAt: new Date(),
          firstName: '',
          lastName: '',
          locale: input.locale ?? 'ar-EG',
          passwordHash: null,
          birthday: null,
        },
      });
    } catch (err) {
      const conflict = detectUniqueConflict(err);
      if (conflict) throw conflict;
      throw err;
    }
  }

  /**
   * Feature 008 — SOCIAL-path lite signup. Mobile + birthday + passwordHash all
   * null; filled later via the Complete-Profile flow (Principle XXXVII).
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
        firstName: input.firstName?.trim() ?? '',
        lastName: input.lastName?.trim() ?? '',
        email: input.email?.toLowerCase().trim() ?? null,
        locale: input.locale ?? 'ar-EG',
        passwordHash: null,
        birthday: null,
      },
    });
  }

  /**
   * Principle XXXVII — mandatory profile-completion write. Fills the lite row
   * with firstName/lastName/birthday (and password for PHONE). The profile
   * photo is persisted separately by `setProfilePhotoKey` at photo-confirm.
   * Birthday becomes immutable from this point.
   */
  async completeProfile(
    input: CompleteProfileInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.customerAccount.update({
      where: { id: input.customerId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        birthday: input.birthday,
        nameSplitNeedsReview: false,
        isVerified: true,
        ...(input.passwordHash !== undefined ? { passwordHash: input.passwordHash } : {}),
      },
    });
  }

  /** Persists the S3 object key for the customer's profile photo (Principle VI/XXXVII). */
  async setProfilePhotoKey(input: SetProfilePhotoKeyInput): Promise<void> {
    await this.prisma.customerAccount.update({
      where: { id: input.customerId },
      data: { profilePhotoKey: input.profilePhotoKey },
    });
  }

  /** Minimal projection for the profile-completeness gate (Principle XXXVII). */
  async findProfileState(customerId: string): Promise<CustomerProfileState | null> {
    return this.prisma.customerAccount.findUnique({
      where: { id: customerId },
      select: {
        registrationPath: true,
        mobileVerifiedAt: true,
        firstName: true,
        lastName: true,
        birthday: true,
        profilePhotoKey: true,
        passwordHash: true,
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
            { firstName: { contains: query.q, mode: 'insensitive' } },
            { lastName: { contains: query.q, mode: 'insensitive' } },
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
          firstName: true,
          lastName: true,
          nameSplitNeedsReview: true,
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
        firstName: r.firstName,
        lastName: r.lastName,
        nameSplitNeedsReview: r.nameSplitNeedsReview,
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
        firstName: true,
        lastName: true,
        nameSplitNeedsReview: true,
        birthday: true,
        profilePhotoKey: true,
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
      firstName: true,
      lastName: true,
      locale: true,
      passwordHash: true,
      registrationPath: true,
      mobileVerifiedAt: true,
      birthday: true,
      profilePhotoKey: true,
      isActive: true,
      isVerified: true,
      createdAt: true,
      lastLoginAt: true,
    } as const;
  }
}
