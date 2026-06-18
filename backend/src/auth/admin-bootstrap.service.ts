import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import { PasswordService } from './password.service';
import { StaffAccountRepository, canonicaliseEmail } from '@/users/staff-account.repository';
import { DuplicateEntryException } from '@/common/errors/domain.exceptions';

/**
 * On every app start, ensure a default admin account exists so a freshly
 * provisioned database always has a usable login. Idempotent: no-ops when the
 * account is already present.
 *
 * SECURITY: the defaults below are a convenience for bootstrapping an
 * environment. The created account is a super_admin with a weak password. For a
 * real production deploy, override the values via env and/or disable entirely
 * with BOOTSTRAP_ADMIN_ENABLED=false, then rotate the password. Unlike the
 * normal user-creation path this deliberately skips PasswordService.validatePolicy
 * (min length / common-list / HIBP) so a short default is accepted.
 */
const DEFAULT_EMAIL = 'admin@masrafy.com';
const DEFAULT_PASSWORD = '123456';
const DEFAULT_NAME = 'Admin';

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly staff: StaffAccountRepository,
    private readonly passwords: PasswordService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env['BOOTSTRAP_ADMIN_ENABLED'] === 'false') {
      return;
    }

    const rawEmail = process.env['BOOTSTRAP_ADMIN_EMAIL'] ?? DEFAULT_EMAIL;
    const password = process.env['BOOTSTRAP_ADMIN_PASSWORD'] ?? DEFAULT_PASSWORD;
    const name = process.env['BOOTSTRAP_ADMIN_NAME'] ?? DEFAULT_NAME;
    const { email } = canonicaliseEmail(rawEmail);

    try {
      const existing = await this.staff.findForLogin(email);
      if (existing) {
        this.logger.log(`bootstrap admin already present (${email}) — no action`);
        return;
      }

      const passwordHash = await this.passwords.hash(password);
      await this.staff.create({
        rawEmail,
        name,
        role: StaffRole.super_admin,
        passwordHash,
        // Frictionless first login with the default password.
        mustChangePassword: false,
      });
      this.logger.warn(
        `bootstrap admin CREATED (${email}). INSECURE DEFAULT — change the password ` +
          `or set BOOTSTRAP_ADMIN_ENABLED=false in production.`,
      );
    } catch (err) {
      if (err instanceof DuplicateEntryException) {
        // Concurrent boot of another instance created it first — fine.
        this.logger.log(`bootstrap admin race (${email}) — already created`);
        return;
      }
      // Never block app startup on this convenience step.
      this.logger.error(`bootstrap admin failed: ${(err as Error).message}`);
    }
  }
}
