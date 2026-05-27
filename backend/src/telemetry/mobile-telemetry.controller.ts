import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import type { Request } from 'express';
import { MobileHmacGuard } from '@/applications/guards/mobile-hmac.guard';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import { CorrelationId } from '@/common/decorators/correlation-id.decorator';
import { OptionalCustomerJwtGuard } from '@/customer-auth/guards/optional-customer-jwt.guard';
import { TelemetryEventNotAllowedException } from '@/common/errors/domain.exceptions';
import { ok } from '@/common/pagination/paginated.response.dto';

const ALLOWED_EVENTS = ['CATALOG_VIEWED', 'QUESTIONNAIRE_STARTED', 'OFFERS_VIEWED'] as const;
type AllowedEvent = (typeof ALLOWED_EVENTS)[number];

class TelemetryEventDto {
  @ApiProperty({ enum: ALLOWED_EVENTS })
  @IsString()
  @IsIn(ALLOWED_EVENTS as readonly string[])
  eventCode!: AllowedEvent;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(24, 32)
  applicationId?: string;
}

type MobileTelemetryRequest = Request & {
  mobileClientId?: string;
  customerId?: string;
};

/**
 * Mobile funnel beacon (PR #7). Mobile clients post one event per stage
 * they reach so the admin lead-analytics page can render
 * catalog → questionnaire → apply → docs → select-offer conversion.
 *
 * Event allowlist is enforced; arbitrary event codes are rejected. Writes
 * go straight into the existing `audit_event` table (no separate funnel
 * table) — the analytics service joins on event type when computing the
 * funnel.
 */
@ApiTags('Mobile · Telemetry')
@Controller('v1/telemetry')
@UseGuards(MobileHmacGuard, OptionalCustomerJwtGuard)
export class MobileTelemetryController {
  constructor(private readonly audit: AuditEventWriter) {}

  @Post('event')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 60, ttl: 60 * 1000 } })
  @ApiOperation({ summary: 'Record a mobile funnel event' })
  async event(
    @Body() body: TelemetryEventDto,
    @Req() req: MobileTelemetryRequest,
    @CorrelationId() correlationId: string,
  ) {
    if (!(ALLOWED_EVENTS as readonly string[]).includes(body.eventCode)) {
      throw new TelemetryEventNotAllowedException({
        eventCode: body.eventCode,
        allowed: ALLOWED_EVENTS,
      });
    }
    await this.audit.write({
      actorId: null,
      targetId: body.applicationId ?? null,
      eventType: body.eventCode as AuditEventType,
      sourceIp: req.ip ?? null,
      correlationId,
      payload: {
        mobileClientId: req.mobileClientId ?? null,
        customerId: req.customerId ?? null,
        applicationId: body.applicationId ?? null,
      },
    });
    return ok({ recorded: true });
  }
}
