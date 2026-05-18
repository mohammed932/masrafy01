import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { DocumentsModule } from '../documents/documents.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { BanksController } from './banks.controller';
import { BanksRepository } from './banks.repository';
import { BanksService } from './banks.service';

@Module({
  imports: [AuthModule, AuditModule, DocumentsModule],
  controllers: [BanksController],
  providers: [RolesGuard, BanksService, BanksRepository],
  exports: [BanksService, BanksRepository],
})
export class BanksModule {}
