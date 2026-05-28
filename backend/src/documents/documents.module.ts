import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApplicationsModule } from '@/applications/applications.module';
import { AuditModule } from '@/audit/audit.module';
import { AuthModule } from '@/auth/auth.module';
import { CustomerAuthModule } from '@/customer-auth/customer-auth.module';
import { InfraModule } from '@/infra/infra.module';
import { PlatformEnumerationsModule } from '@/platform-enumerations/platform-enumerations.module';
import { DocumentsController } from './documents.controller';
import { MobileDocumentsController } from './mobile-documents.controller';
import { DocumentsRepository } from './documents.repository';
import { DocumentsService } from './documents.service';
import { S3StorageClient } from './s3-storage.client';

@Module({
  imports: [
    ConfigModule,
    ApplicationsModule,
    AuditModule,
    AuthModule,
    CustomerAuthModule,
    InfraModule,
    PlatformEnumerationsModule,
  ],
  controllers: [DocumentsController, MobileDocumentsController],
  providers: [S3StorageClient, DocumentsRepository, DocumentsService],
  exports: [DocumentsService, DocumentsRepository, S3StorageClient],
})
export class DocumentsModule {}
