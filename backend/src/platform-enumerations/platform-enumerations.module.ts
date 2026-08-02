import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { AuditModule } from '@/audit/audit.module';
import { CustomerAuthModule } from '@/customer-auth/customer-auth.module';
import { InfraModule } from '@/infra/infra.module';
import { PostgresPlatformEnumerationsRepository } from './postgres-platform-enumerations.repository';
import { PlatformEnumerationsController } from './platform-enumerations.controller';
import { AdminPlatformEnumerationsController } from './admin-platform-enumerations.controller';
import { MobilePlatformEnumerationsController } from './mobile-platform-enumerations.controller';
import { PlatformEnumerationsRepository } from './platform-enumerations.repository';
import { PlatformEnumerationsAdminService } from './platform-enumerations-admin.service';

/**
 * Operator-managed enumeration registry (feature 006).
 * Postgres-backed implementation behind the same abstract class as the
 * legacy in-memory stub — zero call-site changes for consumers.
 *
 * Three controllers: staff-JWT picker reads (`/api/admin/platform-enumerations`
 * dashboard pickers + `/admin/platform-enumerations` operator CRUD) and
 * customer-JWT mobile reads (`/api/v1/platform-enumerations`, Constitution
 * v3.0.0 / Principle XIII — JWT-only).
 */
@Module({
  // Cycle by design: this module needs `CustomerJwtGuard` from customer-auth,
  // and customer-auth needs this registry to validate a profile's governorate.
  imports: [AuthModule, AuditModule, forwardRef(() => CustomerAuthModule), InfraModule],
  controllers: [
    PlatformEnumerationsController,
    AdminPlatformEnumerationsController,
    MobilePlatformEnumerationsController,
  ],
  providers: [
    PostgresPlatformEnumerationsRepository,
    {
      provide: PlatformEnumerationsRepository,
      useExisting: PostgresPlatformEnumerationsRepository,
    },
    PlatformEnumerationsAdminService,
  ],
  exports: [PlatformEnumerationsRepository],
})
export class PlatformEnumerationsModule {}
