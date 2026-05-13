import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@/auth/auth.module';
import { PlatformEnumerationsModule } from '@/platform-enumerations/platform-enumerations.module';
import { DocumentsController } from './documents.controller';
import { DocumentsRepository } from './documents.repository';
import { DocumentsService } from './documents.service';
import { S3StorageClient } from './s3-storage.client';

@Module({
  imports: [ConfigModule, AuthModule, PlatformEnumerationsModule],
  controllers: [DocumentsController],
  providers: [S3StorageClient, DocumentsRepository, DocumentsService],
  exports: [DocumentsService, DocumentsRepository, S3StorageClient],
})
export class DocumentsModule {}
