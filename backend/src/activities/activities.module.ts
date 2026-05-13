import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { ApplicationsModule } from '@/applications/applications.module';
import { BankProgramsModule } from '@/bank-programs/bank-programs.module';
import { AuditModule } from '@/audit/audit.module';
import { DocumentsModule } from '@/documents/documents.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesRepository } from './activities.repository';
import { ActivitiesService } from './activities.service';

@Module({
  imports: [AuthModule, ApplicationsModule, BankProgramsModule, AuditModule, DocumentsModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesRepository, ActivitiesService],
  exports: [ActivitiesRepository, ActivitiesService],
})
export class ActivitiesModule {}
