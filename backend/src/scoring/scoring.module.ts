import { Module } from '@nestjs/common';
import { InfraModule } from '@/infra/infra.module';
import { AuthModule } from '@/auth/auth.module';
import { AuditModule } from '@/audit/audit.module';
import { QuestionnaireModule } from '@/questionnaire/questionnaire.module';
import { BankProgramsModule } from '@/bank-programs/bank-programs.module';
import { PlatformEnumerationsModule } from '@/platform-enumerations/platform-enumerations.module';
import { AdminScoringController } from './admin-scoring.controller';
import { ScoringService } from './scoring.service';
import { ScoringRepository } from './scoring.repository';
import { WeightedApprovalScoringService } from './weighted-approval.service';

/**
 * Feature 00X — approval-scoring weights (Constitution V v5.0.0). Per-bank-program
 * per-question weights, saved directly (no maker-checker). Imports
 * QuestionnaireModule for the shared `parseCategory` util + scored questions;
 * BankProgramsModule to resolve program/bank names for the admin UI;
 * PlatformEnumerationsModule for the program-name catalog, which owns WHICH
 * questions a program scores on (the bank program only owns the weights).
 */
@Module({
  imports: [
    InfraModule,
    AuthModule,
    AuditModule,
    QuestionnaireModule,
    BankProgramsModule,
    PlatformEnumerationsModule,
  ],
  controllers: [AdminScoringController],
  providers: [ScoringService, ScoringRepository, WeightedApprovalScoringService],
  exports: [ScoringService, ScoringRepository, WeightedApprovalScoringService],
})
export class ScoringModule {}
