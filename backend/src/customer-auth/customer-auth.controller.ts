import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { MobileHmacGuard } from '@/applications/guards/mobile-hmac.guard';
import { CorrelationId } from '@/common/decorators/correlation-id.decorator';
import { ok } from '@/common/pagination/paginated.response.dto';
import { CustomerAuthService, type CustomerRequestContext } from './customer-auth.service';
import {
  CustomerAuthEnvelopeDto,
  CustomerLoginRequestDto,
  CustomerLogoutRequestDto,
  CustomerProfileResponseDto,
  CustomerRefreshRequestDto,
  CustomerSignupRequestDto,
} from './dto/customer-auth.dto';
import { CustomerHmacJwtGuard } from './guards/customer-hmac-jwt.guard';

interface HmacRequest extends Request {
  mobileClientId?: string;
  customerId?: string;
}

/**
 * Mobile customer authentication. Constitution v1.7.0 / Principle XIII:
 * - `POST /signup`, `/login`, `/refresh`  → HMAC only (anonymous bootstrap)
 * - `POST /logout`, `GET /me`              → HMAC + customer JWT
 *
 * Refresh tokens are returned in the response body (not cookies) — mobile
 * clients store them in `flutter_secure_storage`.
 */
@ApiTags('Mobile · Customer auth')
@Controller('v1/auth')
export class CustomerAuthController {
  constructor(private readonly svc: CustomerAuthService) {}

  @Post('signup')
  @UseGuards(MobileHmacGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Create a new customer account + issue tokens' })
  async signup(
    @Body() body: CustomerSignupRequestDto,
    @Req() req: HmacRequest,
    @CorrelationId() correlationId: string,
  ): Promise<{ success: true; data: CustomerAuthEnvelopeDto }> {
    const result = await this.svc.signup({
      phone: body.phone,
      name: body.name,
      password: body.password,
      email: body.email,
      locale: body.locale,
      ctx: this.buildContext(req, correlationId),
    });
    return ok(this.toEnvelope(result));
  }

  @Post('login')
  @UseGuards(MobileHmacGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Log in with phone + password' })
  async login(
    @Body() body: CustomerLoginRequestDto,
    @Req() req: HmacRequest,
    @CorrelationId() correlationId: string,
  ): Promise<{ success: true; data: CustomerAuthEnvelopeDto }> {
    const result = await this.svc.login({
      phone: body.phone,
      password: body.password,
      ctx: this.buildContext(req, correlationId),
    });
    return ok(this.toEnvelope(result));
  }

  @Post('refresh')
  @UseGuards(MobileHmacGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60 * 1000 } })
  @ApiOperation({ summary: 'Rotate refresh token, return fresh access token' })
  async refresh(
    @Body() body: CustomerRefreshRequestDto,
    @Req() req: HmacRequest,
    @CorrelationId() correlationId: string,
  ): Promise<{ success: true; data: CustomerAuthEnvelopeDto }> {
    const result = await this.svc.refresh({
      refreshToken: body.refreshToken,
      ctx: this.buildContext(req, correlationId),
    });
    return ok(this.toEnvelope(result));
  }

  @Post('logout')
  @UseGuards(CustomerHmacJwtGuard)
  @ApiBearerAuth('CustomerBearerAuth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke refresh token + record logout' })
  async logout(
    @Body() body: CustomerLogoutRequestDto,
    @Req() req: HmacRequest,
    @CorrelationId() correlationId: string,
  ): Promise<void> {
    const customerId = this.requireCustomer(req);
    await this.svc.logout({
      refreshToken: body.refreshToken,
      customerId,
      ctx: this.buildContext(req, correlationId),
    });
  }

  @Get('me')
  @UseGuards(CustomerHmacJwtGuard)
  @ApiBearerAuth('CustomerBearerAuth')
  @ApiOperation({ summary: 'Currently authenticated customer profile' })
  async me(
    @Req() req: HmacRequest,
  ): Promise<{ success: true; data: CustomerProfileResponseDto }> {
    const customerId = this.requireCustomer(req);
    const profile = await this.svc.me(customerId);
    return ok(profile);
  }

  @Post('claim-applications')
  @UseGuards(CustomerHmacJwtGuard)
  @ApiBearerAuth('CustomerBearerAuth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Link recent guest applications to the authenticated customer',
    description:
      'Bridges the "guest browses offers → signs up at apply gate" path. Finds guest applications for the caller\'s `mobileClientId` in the last 24h and sets `applicantUserId` + `isGuest=false`. Audits one CUSTOMER_GUEST_APP_LINKED per linked row.',
  })
  async claimApplications(
    @Req() req: HmacRequest,
    @CorrelationId() correlationId: string,
  ): Promise<unknown> {
    const customerId = this.requireCustomer(req);
    const mobileClientId = req.mobileClientId;
    if (!mobileClientId) {
      throw new Error('HMAC guard did not attach mobileClientId');
    }
    const result = await this.svc.claimRecentGuestApplications({
      customerId,
      mobileClientId,
      ctx: this.buildContext(req, correlationId),
    });
    return ok(result);
  }

  // ---- Internals ---------------------------------------------------------

  private toEnvelope(r: Awaited<ReturnType<CustomerAuthService['login']>>): CustomerAuthEnvelopeDto {
    return {
      accessToken: r.accessToken,
      accessTokenExpiresIn: r.accessTokenExpiresIn,
      refreshToken: r.refresh.rawToken,
      refreshTokenExpiresIn: r.refresh.ttlSeconds,
      customer: r.customer,
    };
  }

  private buildContext(req: HmacRequest, correlationId: string): CustomerRequestContext {
    return {
      sourceIp: this.readClientIp(req),
      userAgent: this.truncatedUa(req),
      correlationId,
      mobileClientId: req.mobileClientId ?? null,
    };
  }

  private readClientIp(req: HmacRequest): string {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
      const first = xff.split(',')[0]?.trim();
      if (first && first.length > 0) return first;
    }
    return req.ip ?? '0.0.0.0';
  }

  private truncatedUa(req: HmacRequest): string | null {
    const raw = req.headers['user-agent'];
    if (typeof raw !== 'string') return null;
    return raw.length > 500 ? raw.slice(0, 500) : raw;
  }

  private requireCustomer(req: HmacRequest): string {
    // Passport's customer-jwt strategy attaches the verified payload on req.user.
    const user = (req as Request & { user?: { sub?: string } }).user;
    if (!user?.sub) {
      throw new Error('customer JWT guard did not attach req.user.sub');
    }
    return user.sub;
  }
}
