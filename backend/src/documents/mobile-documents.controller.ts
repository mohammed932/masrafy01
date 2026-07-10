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
import { AuditEventType } from '@/common/audit/audit-event-types';
import type { Request } from 'express';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import { CustomerJwtGuard } from '@/customer-auth/guards/customer-jwt.guard';
import { ok } from '@/common/pagination/paginated.response.dto';
import { DocumentsService } from './documents.service';
import {
  MobileConfirmUploadResponseDto,
  MobilePresignedUploadResponseDto,
  MobileRequestUploadUrlDto,
} from './dto/mobile-documents.dto';

type MobileAuthedRequest = Request;

/**
 * Mobile customer document upload (Constitution v3.0.0 / Principle XIII —
 * JWT-only).
 *
 * Two-step protocol so failed PUTs don't leave orphan Document rows:
 *   1. `POST /upload-url` — create row in `pending_upload`, return presigned PUT
 *   2. mobile client PUTs the file directly to S3
 *   3. `POST /:documentId/confirm-upload` — server S3-HEADs, flips to `uploaded`
 *
 * Admin Document review dashboard sees customer-uploaded rows identically to
 * agent-uploaded rows — `uploadedByContext='user'` + `uploadedByCustomerId`
 * disambiguates the source.
 */
@ApiTags('Mobile · Documents')
@ApiBearerAuth('CustomerBearerAuth')
@Controller('v1/applications/:applicationId/documents')
@UseGuards(CustomerJwtGuard)
export class MobileDocumentsController {
  constructor(
    private readonly service: DocumentsService,
    private readonly audit: AuditEventWriter,
  ) {}

  @Post('upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a presigned S3 PUT URL for a customer-side document upload' })
  async requestUploadUrl(
    @Param('applicationId') applicationId: string,
    @Body() dto: MobileRequestUploadUrlDto,
    @Req() req: MobileAuthedRequest,
  ): Promise<{ success: true; data: MobilePresignedUploadResponseDto }> {
    const customerId = this.requireCustomerId(req);
    const out = await this.service.requestCustomerUploadUrl({
      applicationId,
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

  @Post(':documentId/confirm-upload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Flip a customer-side document to `uploaded` after the S3 PUT succeeded',
  })
  async confirmUpload(
    @Param('applicationId') applicationId: string,
    @Param('documentId') documentId: string,
    @Req() req: MobileAuthedRequest,
  ): Promise<{ success: true; data: MobileConfirmUploadResponseDto }> {
    const customerId = this.requireCustomerId(req);
    const result = await this.service.confirmCustomerUpload({
      documentId,
      applicationId,
      customer: { id: customerId },
    });
    await this.audit.write({
      actorId: null,
      targetId: null,
      eventType: AuditEventType.DOCUMENT_UPLOADED,
      sourceIp: req.ip ?? null,
      payload: {
        documentId: result.documentId,
        applicationId,
        uploadedByCustomerId: customerId,
        uploadedBySource: 'mobile_app',
      },
    });
    return ok(result);
  }

  private requireCustomerId(req: MobileAuthedRequest): string {
    const user = (req as Request & { user?: { sub?: string } }).user;
    const sub = user?.sub;
    if (!sub) throw new Error('customer JWT guard did not attach req.user.sub');
    return sub;
  }
}
