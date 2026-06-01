import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import { CustomerJwtGuard } from '@/customer-auth/guards/customer-jwt.guard';
import { CorrelationId } from '@/common/decorators/correlation-id.decorator';
import { ok } from '@/common/pagination/paginated.response.dto';
import { DocumentsService } from './documents.service';
import {
  ProfileDocUploadUrlDto,
  ProfilePhotoConfirmDto,
  ProfilePhotoUploadUrlDto,
} from './dto/customer-profile-document.dto';

/**
 * Customer-scoped profile uploads (Principle XXXVII). National ID front/back
 * are stored as customer-owned `Document` rows; the profile photo is persisted
 * as `customerAccount.profilePhotoKey`. These run BEFORE any application
 * exists — that is why they are not under `/v1/applications/:id/documents`.
 */
@ApiTags('Mobile · Profile documents')
@ApiBearerAuth('CustomerBearerAuth')
@Controller('v1/profile')
@UseGuards(CustomerJwtGuard)
export class CustomerProfileDocumentsController {
  constructor(
    private readonly service: DocumentsService,
    private readonly audit: AuditEventWriter,
  ) {}

  @Post('documents/upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Presigned PUT URL for a National ID front/back upload (customer-scoped)' })
  async requestDocUploadUrl(
    @Body() dto: ProfileDocUploadUrlDto,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const customerId = this.requireCustomerId(req);
    const out = await this.service.requestCustomerProfileDocUploadUrl({
      documentType: dto.documentType,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      originalFilename: dto.originalFilename,
      customer: { id: customerId },
    });
    return ok({
      documentId: out.documentId,
      uploadUrl: out.uploadUrl,
      s3Key: out.s3Key,
      expiresAt: out.expiresAt.toISOString(),
      maxSizeBytes: out.maxSizeBytes,
    });
  }

  @Post('documents/:documentId/confirm-upload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Flip a customer National ID document to `uploaded` after the S3 PUT' })
  async confirmDocUpload(
    @Param('documentId') documentId: string,
    @Req() req: Request,
    @CorrelationId() correlationId: string,
  ): Promise<{ success: true; data: unknown }> {
    const customerId = this.requireCustomerId(req);
    const result = await this.service.confirmCustomerProfileDocUpload({
      documentId,
      customer: { id: customerId },
    });
    await this.audit.write({
      actorId: null,
      targetId: null,
      eventType: AuditEventType.DOCUMENT_UPLOADED,
      sourceIp: req.ip ?? null,
      correlationId,
      payload: { documentId: result.documentId, uploadedByCustomerId: customerId, scope: 'profile' },
    });
    return ok(result);
  }

  @Post('photo/upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Presigned PUT URL for the customer profile photo' })
  async requestPhotoUploadUrl(
    @Body() dto: ProfilePhotoUploadUrlDto,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const customerId = this.requireCustomerId(req);
    const out = await this.service.requestProfilePhotoUploadUrl({
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      customer: { id: customerId },
    });
    return ok({
      uploadUrl: out.uploadUrl,
      s3Key: out.s3Key,
      expiresAt: out.expiresAt.toISOString(),
      maxSizeBytes: out.maxSizeBytes,
    });
  }

  @Post('photo/confirm-upload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Persist the profile photo S3 key after the PUT succeeded' })
  async confirmPhotoUpload(
    @Body() dto: ProfilePhotoConfirmDto,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const customerId = this.requireCustomerId(req);
    const result = await this.service.confirmProfilePhotoUpload({
      s3Key: dto.s3Key,
      customer: { id: customerId },
    });
    return ok(result);
  }

  private requireCustomerId(req: Request): string {
    const sub = (req as Request & { user?: { sub?: string } }).user?.sub;
    if (!sub) throw new Error('customer JWT guard did not attach req.user.sub');
    return sub;
  }
}
