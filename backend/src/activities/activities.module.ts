import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { ApplicationsModule } from '@/applications/applications.module';
import { BankProgramsModule } from '@/bank-programs/bank-programs.module';
import { AuditModule } from '@/audit/audit.module';
import { DocumentsModule } from '@/documents/documents.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesRepository } from './activities.repository';
import { ActivitiesService } from './activities.service';
import { StaleLeadScanner } from './stale-lead-scanner';
import { StaleLeadCronController } from './stale-lead-cron.controller';
import { RemindersController } from './reminders.controller';

const cronControllers =
  process.env.NODE_ENV !== 'production' ? [StaleLeadCronController] : [];

@Module({
  imports: [AuthModule, ApplicationsModule, BankProgramsModule, AuditModule, DocumentsModule],
  controllers: [ActivitiesController, RemindersController, ...cronControllers],
  providers: [ActivitiesRepository, ActivitiesService, StaleLeadScanner],
  exports: [ActivitiesRepository, ActivitiesService, StaleLeadScanner],
})
export class ActivitiesModule {}
