import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { PlatformEnumerationsModule } from '../platform-enumerations/platform-enumerations.module';
import { QuestionnaireModule } from '../questionnaire/questionnaire.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { BankProgramsController } from './bank-programs.controller';
import { BankProgramsMobileController } from './bank-programs.mobile.controller';
import { BankProgramsService } from './bank-programs.service';
import { BankProgramsMobileService } from './bank-programs.mobile.service';
import { BankProgramRepository } from './bank-programs.repository';
import { ProgramOptionsController } from './program-options.controller';
import { ProgramOptionsService } from './program-options.service';
import { SeedService } from './seeds/seed.service';
import { SeedAbkController } from './seeds/seed-abk.controller';
import { SeedCompetitorController } from './seeds/seed-competitor.controller';
import { BlueprintService } from './blueprints/blueprint.service';
import { ProductAsksService } from './asks/product-asks.service';
import { ProductAsksRepository } from './asks/product-asks.repository';

@Module({
  // `QuestionnaireModule` because building a predefined product creates the questions it
  // asks — the same service an operator's clicks go through, so every refusal and every
  // publish behaves identically. `forwardRef` for the reason that module's own header gives:
  // it already sits in a three-hop cycle with `platform-enumerations` and `customer-auth`,
  // and a plain reference at any point in a cycle resolves to `undefined` for whichever
  // module the loader reaches first.
  imports: [
    AuthModule,
    AuditModule,
    CustomerAuthModule,
    PlatformEnumerationsModule,
    forwardRef(() => QuestionnaireModule),
  ],
  controllers: [
    BankProgramsController,
    BankProgramsMobileController,
    ProgramOptionsController,
    SeedAbkController,
    SeedCompetitorController,
  ],
  providers: [
    RolesGuard,
    BankProgramsService,
    BankProgramsMobileService,
    BankProgramRepository,
    ProgramOptionsService,
    SeedService,
    BlueprintService,
    // The ask door on a product's step ①. Its own provider rather than methods on
    // `BankProgramsService`, which deliberately injects no `QuestionnaireService` — a tick
    // publishes the questionnaire, and that service's positional constructor is pinned by
    // tests.
    ProductAsksService,
    ProductAsksRepository,
  ],
  exports: [BankProgramsService, BankProgramRepository],
})
export class BankProgramsModule {}
