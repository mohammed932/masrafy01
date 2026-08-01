import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { PlatformEnumerationsModule } from '../platform-enumerations/platform-enumerations.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrefillService } from './prefill/prefill.service';
import { BankProgramsController } from './bank-programs.controller';
import { BankProgramsMobileController } from './bank-programs.mobile.controller';
import { BankProgramsService } from './bank-programs.service';
import { BankProgramsMobileService } from './bank-programs.mobile.service';
import { BankProgramRepository } from './bank-programs.repository';
import { SeedService } from './seeds/seed.service';
import { SeedAbkController } from './seeds/seed-abk.controller';
import { SeedCompetitorController } from './seeds/seed-competitor.controller';

@Module({
  imports: [AuthModule, AuditModule, CustomerAuthModule, PlatformEnumerationsModule],
  controllers: [
    BankProgramsController,
    BankProgramsMobileController,
    SeedAbkController,
    SeedCompetitorController,
  ],
  providers: [
    RolesGuard,
    BankProgramsService,
    BankProgramsMobileService,
    BankProgramRepository,
    PrefillService,
    SeedService,
  ],
  exports: [BankProgramsService, BankProgramRepository],
})
export class BankProgramsModule {}
