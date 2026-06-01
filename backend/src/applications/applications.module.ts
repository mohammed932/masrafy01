/**
 * Applications module — mobile apply endpoint + admin read endpoints.
 */

import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { AdminApplicationsController } from './admin-applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationRepository } from './application.repository';
import { MatchingModule } from '../matching/matching.module';
import { BankProgramsModule } from '../bank-programs/bank-programs.module';
import { AuditModule } from '../audit/audit.module';
import { ScoringVersionsModule } from '../scoring-versions/scoring-versions.module';
import { MobileRateLimitGuard } from './guards/mobile-rate-limit.guard';
import { CustomerAuthModule } from '@/customer-auth/customer-auth.module';
import { AuthModule } from '@/auth/auth.module';
import { QuestionnaireModule } from '@/questionnaire/questionnaire.module';

import { CustomerTimelineService } from './customer-timeline.service';
import { CustomerTimelineRepository } from './customer-timeline.repository';

/**
 * Imports `CustomerAuthModule` so the apply endpoint can require a valid
 * `CustomerJwtGuard`. Constitution v3.0.0 / Principle XIII: mobile API is
 * JWT-only — HMAC pinning was removed.
 */
@Module({
  imports: [
    MatchingModule,
    BankProgramsModule,
    AuditModule,
    ScoringVersionsModule,
    CustomerAuthModule,
    QuestionnaireModule,
    // Exports `StaffAccountRepository` for cross-feature staff-account reads
    // (e.g. assignAgent target validation). Constitution Principle X — service
    // never calls Prisma directly.
    AuthModule,
  ],
  controllers: [ApplicationsController, AdminApplicationsController],
  providers: [
    ApplicationsService,
    ApplicationRepository,
    CustomerTimelineService,
    CustomerTimelineRepository,
    MobileRateLimitGuard,
  ],
  exports: [ApplicationRepository],
})
export class ApplicationsModule {}
