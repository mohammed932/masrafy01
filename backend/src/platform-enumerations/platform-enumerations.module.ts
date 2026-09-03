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
  // `PlatformEnumerationsAdminService` is exported so the predefined-product library can
  // create its lists, values and facts through the SAME service an operator's clicks go
  // through — every refusal, every audit event, every cache invalidation included. A
  // second, quieter write path would be a second set of rules free to disagree.
  exports: [
    PlatformEnumerationsRepository,
    PlatformEnumerationsAdminService,
    ProgramNameScopeService,
    // The CONCRETE repository, for the same reason the admin service injects it rather than
    // the abstract: a handful of admin-only reads are deliberately not on the abstract,
    // because the in-memory stub exists to serve the ENGINE and would have to grow a fake
    // implementation of each one to satisfy a contract no quote path uses
    // (`boundQuestions`, `findByTypeAndKey`, the fact-reader scan, the ask board's question
    // pool). Read-only consumers only: every WRITE still goes through the admin service
    // above, so the audit event, the cache invalidation and the guards stay one
    // implementation.
    PostgresPlatformEnumerationsRepository,
  ],
})
export class PlatformEnumerationsModule {}
