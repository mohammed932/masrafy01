import { Module } from '@nestjs/common';
import { CustomerAuthModule } from '@/customer-auth/customer-auth.module';
import { QuestionnaireModule } from '@/questionnaire/questionnaire.module';
import { ScoringModule } from '@/scoring/scoring.module';
import { BankProgramsModule } from '@/bank-programs/bank-programs.module';
import { MatchingPreviewController } from './matching-preview.controller';
import { MatchingPreviewService } from './matching-preview.service';

/**
 * Feature 00X — mobile matching preview. Reuses the questionnaire snapshot +
 * scoring weight sets + active bank programs to rank by approval probability.
 */
@Module({
  imports: [CustomerAuthModule, QuestionnaireModule, ScoringModule, BankProgramsModule],
  controllers: [MatchingPreviewController],
  providers: [MatchingPreviewService],
})
export class MatchingPreviewModule {}
