import { Module } from '@nestjs/common';
import { InfraModule } from '@/infra/infra.module';
import { AuthModule } from '@/auth/auth.module';
import { AuditModule } from '@/audit/audit.module';
import { QuestionnaireModule } from '@/questionnaire/questionnaire.module';
import { BankProgramsModule } from '@/bank-programs/bank-programs.module';
import { AdminScoringController } from './admin-scoring.controller';
import { ScoringService } from './scoring.service';
import { ScoringRepository } from './scoring.repository';
import { WeightedApprovalScoringService } from './weighted-approval.service';

/**
 * Feature 00X — approval-scoring weights (Constitution V v4.1.0). Per-bank-program
 * weights via two-person maker-checker; factors are admin/seed data.
 * Imports QuestionnaireModule for the shared `parseCategory` util + question
 * labels; BankProgramsModule to resolve program/bank names for the admin UI.
 */
@Module({
  imports: [InfraModule, AuthModule, AuditModule, QuestionnaireModule, BankProgramsModule],
  controllers: [AdminScoringController],
  providers: [ScoringService, ScoringRepository, WeightedApprovalScoringService],
  exports: [ScoringService, ScoringRepository, WeightedApprovalScoringService],
})
export class ScoringModule {}
