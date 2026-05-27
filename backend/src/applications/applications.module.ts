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
import { MobileHmacGuard } from './guards/mobile-hmac.guard';
import { MobileRateLimitGuard } from './guards/mobile-rate-limit.guard';
import { CustomerAuthModule } from '@/customer-auth/customer-auth.module';
import { AuthModule } from '@/auth/auth.module';

import { CustomerTimelineService } from './customer-timeline.service';
import { CustomerTimelineRepository } from './customer-timeline.repository';

/**
 * Imports `CustomerAuthModule` because the apply endpoint reads the optional
 * customer JWT (`OptionalCustomerJwtGuard`) and the `/applications/claim`
 * endpoint hands off to `CustomerAuthService`. `CustomerAuthModule` does not
 * depend back on this module — it borrows `MobileHmacGuard` via direct
 * provider registration to avoid a cycle.
 */
@Module({
  imports: [
    MatchingModule,
    BankProgramsModule,
    AuditModule,
    ScoringVersionsModule,
    CustomerAuthModule,
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
    MobileHmacGuard,
    MobileRateLimitGuard,
  ],
  exports: [ApplicationRepository, MobileHmacGuard],
})
export class ApplicationsModule {}
