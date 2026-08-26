import { Module, forwardRef } from '@nestjs/common';
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
  // `forwardRef` since that module now imports this one back: a write to a value of a
  // MIRRORED list has to re-sync the question whose options it is, and this service is the
  // only writer of `question_option`.
  //
  // `CustomerAuthModule` is forwardRef'd as well, and it has to be: the cycle is now
  // three hops (`platform-enumerations → questionnaire → customer-auth → platform-enumerations`)
  // and a plain reference at ANY point in a cycle resolves to `undefined` for whichever module
  // the loader reaches first. Nest reports that as "the module at index [2] is undefined",
  // which reads as a typo rather than as the cycle it is.
  imports: [
    InfraModule,
    AuthModule,
    forwardRef(() => CustomerAuthModule),
    forwardRef(() => PlatformEnumerationsModule),
  ],
  controllers: [QuestionnaireController, AdminQuestionnaireController],
  providers: [QuestionnaireService, QuestionnaireRepository],
  exports: [QuestionnaireService, QuestionnaireRepository],
})
export class QuestionnaireModule {}
