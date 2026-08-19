import { Module } from '@nestjs/common';
import { CustomerAuthModule } from '@/customer-auth/customer-auth.module';
import { BankProgramsModule } from '@/bank-programs/bank-programs.module';
import { PlatformEnumerationsModule } from '@/platform-enumerations/platform-enumerations.module';
import { CalculatorController } from './calculator.controller';
import { CalculatorService } from './calculator.service';

/**
 * Feature 010 — customer loan calculator. Read-only: composes the same pure
 * `quoteProgram` the matching engine uses, over the live bank programs.
 */
@Module({
  imports: [CustomerAuthModule, BankProgramsModule, PlatformEnumerationsModule],
  controllers: [CalculatorController],
  providers: [CalculatorService],
})
export class CalculatorModule {}
