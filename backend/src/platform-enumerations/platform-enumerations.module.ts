import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { AuditModule } from '@/audit/audit.module';
import { CustomerAuthModule } from '@/customer-auth/customer-auth.module';
import { InfraModule } from '@/infra/infra.module';
import { QuestionnaireModule } from '@/questionnaire/questionnaire.module';
import { PostgresPlatformEnumerationsRepository } from './postgres-platform-enumerations.repository';
import { PlatformEnumerationsController } from './platform-enumerations.controller';
import { AdminPlatformEnumerationsController } from './admin-platform-enumerations.controller';
import { MobilePlatformEnumerationsController } from './mobile-platform-enumerations.controller';
import { PlatformEnumerationsRepository } from './platform-enumerations.repository';
import { PlatformEnumerationsAdminService } from './platform-enumerations-admin.service';
import { ProgramNameScopeService } from './program-name-scope.service';

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
  // Two cycles by design, both feature→feature (Principle IX), neither a reach into
  // `common/`:
  //   customer-auth — this module needs `CustomerJwtGuard`, and customer-auth needs this
  //     registry to validate a profile's governorate.
  //   questionnaire — a mirrored list's values ARE a question's options, so a write here has
  //     to re-sync and republish; questionnaire in turn needs the live member list to warn
  //     when a fact's option codes drift from the registry they are supposed to BE.
  imports: [
    AuthModule,
    AuditModule,
    forwardRef(() => CustomerAuthModule),
    forwardRef(() => QuestionnaireModule),
    InfraModule,
  ],
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
    ProgramNameScopeService,
  ],
  exports: [PlatformEnumerationsRepository, ProgramNameScopeService],
})
export class PlatformEnumerationsModule {}
