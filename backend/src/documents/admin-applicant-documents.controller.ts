/**
 * Admin applicant-documents reads for the application detail page.
 *
 * Scoped by application id; the service resolves the owning customer and returns
 * the profile photo (presigned) + National ID side metadata. Revealing a NID
 * image is a separate, audited call (Constitution Principle VI). Analysts are
 * excluded from these routes entirely — they never receive document binaries
 * (VI + FR-014), matching the existing DocumentsController download roles.
 */

import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { DocumentsService, type ApplicantDocumentsView } from './documents.service';

@ApiTags('Admin · Applications')
@ApiBearerAuth()
@Controller('admin/applications/:applicationId/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'sales_manager', 'sales_agent')
export class AdminApplicantDocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: "Applicant's profile photo (presigned) + National ID metadata" })
  async list(
    @Param('applicationId') applicationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ success: true; data: ApplicantDocumentsView }> {
    const data = await this.service.getApplicantDocuments(applicationId, { role: user.role });
    return { success: true, data };
  }

  @Get(':documentId/reveal')
  @ApiOperation({ summary: 'Reveal a National ID image (presigned URL; writes an audit event)' })
  async reveal(
    @Param('applicationId') applicationId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<{ success: true; data: { url: string; expiresAt: string } }> {
    const data = await this.service.revealApplicantDocument({
      applicationId,
      documentId,
      requester: { staffId: user.sub, role: user.role },
      sourceIp: this.readClientIp(req),
    });
    return { success: true, data };
  }

  private readClientIp(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim() ?? null;
    }
    return req.ip ?? null;
  }
}
