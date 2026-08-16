import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { PlatformEnumerationsModule } from '../platform-enumerations/platform-enumerations.module';
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

@Module({
  imports: [AuthModule, AuditModule, CustomerAuthModule, PlatformEnumerationsModule],
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
  ],
  exports: [BankProgramsService, BankProgramRepository],
})
export class BankProgramsModule {}
