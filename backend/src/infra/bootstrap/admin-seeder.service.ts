import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/infra/prisma/prisma.service';

/**
 * Ensures a `super_admin` exists on every boot so the admin dashboard is
 * immediately usable in local/dev environments. Idempotent — creates the
 * account when absent, and re-syncs the password to the seed value when it
 * already exists (so a forgotten dev password is recoverable by reboot).
 *
 * Credentials come from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` /
 * `SEED_ADMIN_NAME` (defaults: `admin@gmail.com` / `123456` / `Admin`).
 *
 * SECURITY: gated to non-production. A weak default admin must never be
 * auto-provisioned in prod — production onboarding stays with
 * `npx prisma db seed` + a strong `SEED_ADMIN_PASSWORD` (Principle VI). This
 * seeder deliberately bypasses the NIST password policy (`PasswordService`) so
 * short dev passwords like `admin` are accepted.
 */
@Injectable()
export class AdminSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeederService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env['NODE_ENV'] === 'production') {
      this.logger.log('admin seed skipped (production)');
      return;
    }

    const display = (process.env['SEED_ADMIN_EMAIL'] ?? 'admin@gmail.com').trim();
    const email = display.normalize('NFKC').toLowerCase();
    const password = process.env['SEED_ADMIN_PASSWORD'] ?? '123456';
    const name = (process.env['SEED_ADMIN_NAME'] ?? 'Admin').trim();
    const cost = Number(process.env['BCRYPT_COST'] ?? 12);

    try {
      const passwordHash = await bcrypt.hash(password, cost);

      const existing = await this.prisma.staffAccount.findUnique({ where: { email } });
      if (existing) {
        await this.prisma.staffAccount.update({
          where: { email },
          data: { passwordHash, mustChangePassword: false },
        });
        this.logger.warn(
          `admin seed: super_admin present (${email}) — password reset to DEV credentials`,
        );
        return;
      }

      await this.prisma.staffAccount.create({
        data: {
          email,
          emailDisplay: display,
          name,
          passwordHash,
          role: StaffRole.super_admin,
          isActive: true,
          // Usable as-is in dev — do not force a change on first login.
          mustChangePassword: false,
        },
      });
      this.logger.warn(
        `admin seed: created super_admin (${email}) — DEV credentials, change before any shared/prod use`,
      );
    } catch (err) {
      // A seeder failure must never crash application startup.
      this.logger.error(`admin seed failed: ${(err as Error).message}`);
    }
  }
}
