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

import { CustomerTimelineService } from './customer-timeline.service';

@Module({
  imports: [MatchingModule, BankProgramsModule, AuditModule, ScoringVersionsModule],
  controllers: [ApplicationsController, AdminApplicationsController],
  providers: [
    ApplicationsService,
    ApplicationRepository,
    CustomerTimelineService,
    MobileHmacGuard,
    MobileRateLimitGuard,
  ],
  exports: [ApplicationRepository],
})
export class ApplicationsModule {}
