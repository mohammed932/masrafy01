import { Module } from '@nestjs/common';
import { CustomerAuthModule } from '@/customer-auth/customer-auth.module';
import { AuthModule } from '@/auth/auth.module';
import { QuestionnaireModule } from '@/questionnaire/questionnaire.module';
import { ScoringModule } from '@/scoring/scoring.module';
import { BankProgramsModule } from '@/bank-programs/bank-programs.module';
import { PlatformEnumerationsModule } from '@/platform-enumerations/platform-enumerations.module';
import { MatchingPreviewController } from './matching-preview.controller';
import { AdminMatchingController } from './admin-matching.controller';
import { MatchingPreviewService } from './matching-preview.service';

/**
 * Feature 00X — mobile matching preview. Reuses the questionnaire snapshot +
 * scoring weight sets + active bank programs to rank by approval probability.
 */
@Module({
  imports: [
    CustomerAuthModule,
    AuthModule,
    QuestionnaireModule,
    ScoringModule,
    BankProgramsModule,
    PlatformEnumerationsModule,
  ],
  controllers: [MatchingPreviewController, AdminMatchingController],
  providers: [MatchingPreviewService],
})
export class MatchingPreviewModule {}
