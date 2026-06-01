import { Module } from '@nestjs/common';
import { InfraModule } from '@/infra/infra.module';
import { AuthModule } from '@/auth/auth.module';
import { CustomerAuthModule } from '@/customer-auth/customer-auth.module';
import { QuestionnaireController } from './questionnaire.controller';
import { AdminQuestionnaireController } from './admin-questionnaire.controller';
import { QuestionnaireService } from './questionnaire.service';
import { QuestionnaireRepository } from './questionnaire.repository';

/**
 * Feature 00X — Dynamic Questionnaire (Constitution V v4.1.0). Admin-editable
 * questions/options/branching/versioning + JWT-gated mobile fetch.
 */
@Module({
  imports: [InfraModule, AuthModule, CustomerAuthModule],
  controllers: [QuestionnaireController, AdminQuestionnaireController],
  providers: [QuestionnaireService, QuestionnaireRepository],
  exports: [QuestionnaireService, QuestionnaireRepository],
})
export class QuestionnaireModule {}
