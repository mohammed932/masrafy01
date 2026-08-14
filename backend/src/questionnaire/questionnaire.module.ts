import { Module } from '@nestjs/common';
import { InfraModule } from '@/infra/infra.module';
import { AuthModule } from '@/auth/auth.module';
import { CustomerAuthModule } from '@/customer-auth/customer-auth.module';
import { PlatformEnumerationsModule } from '@/platform-enumerations/platform-enumerations.module';
import { QuestionnaireController } from './questionnaire.controller';
import { AdminQuestionnaireController } from './admin-questionnaire.controller';
import { QuestionnaireService } from './questionnaire.service';
import { QuestionnaireRepository } from './questionnaire.repository';

/**
 * Feature 00X — Dynamic Questionnaire (Constitution V v4.1.0). Admin-editable
 * questions/options/branching/versioning + JWT-gated mobile fetch.
 */
@Module({
  // `PlatformEnumerationsModule` (feature 011): publish warns when a surrogate
  // fact's option codes drift from the registry they are supposed to BE (FR-017),
  // which needs the live member list. Exported by that module, so this is a
  // feature→feature import, not a reach into `common/` (Principle IX).
  imports: [InfraModule, AuthModule, CustomerAuthModule, PlatformEnumerationsModule],
  controllers: [QuestionnaireController, AdminQuestionnaireController],
  providers: [QuestionnaireService, QuestionnaireRepository],
  exports: [QuestionnaireService, QuestionnaireRepository],
})
export class QuestionnaireModule {}
