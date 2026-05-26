import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { AuditModule } from '@/audit/audit.module';
import { InfraModule } from '@/infra/infra.module';
import { MobileHmacGuard } from '@/applications/guards/mobile-hmac.guard';
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
 * HMAC-only mobile reads (`/api/v1/platform-enumerations`, v1.7.0).
 */
@Module({
  imports: [AuthModule, AuditModule, InfraModule],
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
    MobileHmacGuard,
  ],
  exports: [PlatformEnumerationsRepository],
})
export class PlatformEnumerationsModule {}
