import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import { RequestUploadUrlDto } from './dto/request-upload-url.dto';
import {
  PresignedDownloadResponseDto,
  PresignedUploadResponseDto,
} from './dto/document.response.dto';

@ApiTags('Admin · Documents')
@ApiBearerAuth()
@Controller('admin/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post('upload-url')
  @Roles('super_admin', 'sales_manager', 'sales_agent')
  @ApiOperation({ summary: 'Request a presigned S3 PUT URL for a document' })
  async requestUploadUrl(
    @Body() dto: RequestUploadUrlDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ success: true; data: PresignedUploadResponseDto }> {
    const out = await this.service.requestUploadUrl({
      applicationId: dto.applicationId,
      documentType: dto.documentType,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      originalFilename: dto.originalFilename,
      uploadedBySource: dto.uploadedBySource,
      actor: { staffId: user.sub, role: user.role },
    });
    return {
      success: true,
      data: {
        documentId: out.documentId,
        uploadUrl: out.uploadUrl,
        s3Key: out.s3Key,
        expiresAt: out.expiresAt.toISOString(),
        maxSizeBytes: out.maxSizeBytes,
      },
    };
  }

  @Get(':id/download')
  @Roles('super_admin', 'sales_manager', 'sales_agent')
  @ApiOperation({ summary: 'Get a presigned S3 GET URL to download a document' })
  async getDownloadUrl(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ success: true; data: PresignedDownloadResponseDto }> {
    const { downloadUrl, expiresAt } = await this.service.getDownloadUrl(id, {
      staffId: user.sub,
      role: user.role,
    });
    return {
      success: true,
      data: { downloadUrl, expiresAt: expiresAt.toISOString() },
    };
  }
}
