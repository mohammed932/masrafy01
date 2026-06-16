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
import { QuestionnaireModule } from '@/questionnaire/questionnaire.module';
import { ScoringModule } from '@/scoring/scoring.module';

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
    ScoringModule,
  ],
  controllers: [ApplicationsController, AdminApplicationsController],
  providers: [ApplicationsService, ApplicationRepository, MobileRateLimitGuard],
  exports: [ApplicationRepository],
})
export class ApplicationsModule {}
