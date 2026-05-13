import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { AuditModule } from '@/audit/audit.module';
import { PostgresPlatformEnumerationsRepository } from './postgres-platform-enumerations.repository';
import { PlatformEnumerationsController } from './platform-enumerations.controller';
import { AdminPlatformEnumerationsController } from './admin-platform-enumerations.controller';
import { PlatformEnumerationsRepository } from './platform-enumerations.repository';
import { PlatformEnumerationsAdminService } from './platform-enumerations-admin.service';

/**
 * Operator-managed enumeration registry (feature 006).
 * Postgres-backed implementation behind the same abstract class as the
 * legacy in-memory stub — zero call-site changes for consumers.
 */
@Module({
  imports: [AuthModule, AuditModule],
  controllers: [PlatformEnumerationsController, AdminPlatformEnumerationsController],
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
