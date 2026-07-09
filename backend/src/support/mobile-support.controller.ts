import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CustomerJwtGuard } from '@/customer-auth/guards/customer-jwt.guard';
import { ok } from '@/common/pagination/paginated.response.dto';
import { SupportService } from './support.service';
import {
  CreateSupportRequestDto,
  SupportContactResponseDto,
  SupportRequestResponseDto,
} from './dto/support.dto';

type MobileSupportRequest = Request;

@ApiTags('Mobile · Support')
@ApiBearerAuth('CustomerBearerAuth')
@Controller('v1/support')
@UseGuards(CustomerJwtGuard)
export class MobileSupportController {
  constructor(private readonly svc: SupportService) {}

  @Get('contact')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Mobile-facing support contact info (singleton config row)' })
  async contact(): Promise<{ success: true; data: SupportContactResponseDto }> {
    const data = await this.svc.getMobileContact();
    return ok(data);
  }

  @Post('requests')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60 * 1000 } })
  @ApiOperation({
    summary: 'Customer-initiated support request',
    description:
      'Logs the customer\'s "Need Help" tap with the channel they chose. Requires a valid customer JWT (Constitution v3.0.0 / Principle XIII).',
  })
  async create(
    @Body() body: CreateSupportRequestDto,
    @Req() req: MobileSupportRequest,
  ): Promise<{ success: true; data: SupportRequestResponseDto }> {
    const user = (req as Request & { user?: { sub?: string } }).user;
    const customerId = user?.sub;
    if (!customerId) {
      throw new Error('customer JWT guard did not attach req.user.sub');
    }
    const data = await this.svc.createMobileRequest({
      channel: body.channel,
      applicationId: body.applicationId,
      note: body.note,
      customerId,
      ctx: { sourceIp: req.ip ?? null },
    });
    return ok(data);
  }
}
