import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CorrelationId } from '@/common/decorators/correlation-id.decorator';
import { ok } from '@/common/pagination/paginated.response.dto';
import { SocialProvider, OtpPurpose } from './dto/enums';
import { CustomerAuthService, type CustomerRequestContext } from './customer-auth.service';
import { CustomerAuthMobileService } from './customer-auth-mobile.service';
import {
  CustomerAuthEnvelopeDto,
  CustomerLoginRequestDto,
  CustomerLogoutRequestDto,
  CustomerProfileResponseDto,
  CustomerRefreshRequestDto,
  CustomerSignupRequestDto,
} from './dto/customer-auth.dto';
import { OtpRequestDto, OtpVerifyDto } from './dto/customer-otp.dto';
import {
  CustomerSignupPhoneStartDto,
  CustomerSignupPhoneCompleteDto,
} from './dto/customer-signup-phone.dto';
import {
  SocialAppleSignInDto,
  SocialGoogleSignInDto,
  SocialLoginDto,
} from './dto/customer-social.dto';
import {
  ProfileMobileRequestOtpDto,
  ProfileMobileVerifyOtpDto,
} from './dto/customer-profile-completion.dto';
import { PasswordChangeDto, PasswordResetDto } from './dto/customer-password.dto';
import { CustomerJwtGuard } from './guards/customer-jwt.guard';

interface MobileRequest extends Request {
  customerId?: string;
}

/**
 * Mobile customer authentication. Constitution v3.0.0 / Principle XIII:
 * - `POST /signup`, `/login`, `/refresh`  → public (anonymous bootstrap)
 * - `POST /logout`, `GET /me`              → customer JWT
 *
 * Refresh tokens are returned in the response body (not cookies) — mobile
 * clients store them in `flutter_secure_storage`.
 */
@ApiTags('Mobile · Customer auth')
@Controller('v1/auth')
export class CustomerAuthController {
  constructor(
    private readonly svc: CustomerAuthService,
    private readonly mobile: CustomerAuthMobileService,
  ) {}

  @Post('signup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Create a new customer account + issue tokens' })
  async signup(
    @Body() body: CustomerSignupRequestDto,
    @Req() req: MobileRequest,
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
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Log in with phone + password (feature 008: with lockout per FR-022)' })
  async login(
    @Body() body: CustomerLoginRequestDto,
    @Req() req: MobileRequest,
    @CorrelationId() correlationId: string,
  ): Promise<{ success: true; data: CustomerAuthEnvelopeDto }> {
    const result = await this.mobile.loginWithLockout({
      phone: body.phone,
      password: body.password,
      ctx: this.buildContext(req, correlationId),
    });
    return ok(this.toEnvelope(result));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60 * 1000 } })
  @ApiOperation({ summary: 'Rotate refresh token, return fresh access token' })
  async refresh(
    @Body() body: CustomerRefreshRequestDto,
    @Req() req: MobileRequest,
    @CorrelationId() correlationId: string,
  ): Promise<{ success: true; data: CustomerAuthEnvelopeDto }> {
    const result = await this.svc.refresh({
      refreshToken: body.refreshToken,
      ctx: this.buildContext(req, correlationId),
    });
    return ok(this.toEnvelope(result));
  }

  @Post('logout')
  @UseGuards(CustomerJwtGuard)
  @ApiBearerAuth('CustomerBearerAuth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke refresh token + record logout' })
  async logout(
    @Body() body: CustomerLogoutRequestDto,
    @Req() req: MobileRequest,
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
  @UseGuards(CustomerJwtGuard)
  @ApiBearerAuth('CustomerBearerAuth')
  @ApiOperation({ summary: 'Currently authenticated customer profile' })
  async me(
    @Req() req: MobileRequest,
  ): Promise<{ success: true; data: CustomerProfileResponseDto }> {
    const customerId = this.requireCustomer(req);
    const profile = await this.svc.me(customerId);
    return ok(profile);
  }

  // -------------------------------------------------------------------------
  // Feature 008 — Two-Path Registration endpoints (Constitution v1.8.0).
  // The legacy `POST /signup` and `claim-applications` (now removed) endpoint
  // are replaced by the two-step phone-signup flow + social paths below.
  // -------------------------------------------------------------------------

  @Post('signup/phone/start')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'PHONE signup — step 1: request OTP for new phone' })
  async signupPhoneStart(
    @Body() body: CustomerSignupPhoneStartDto,
    @Req() req: MobileRequest,
    @CorrelationId() correlationId: string,
  ): Promise<unknown> {
    const result = await this.mobile.signupPhoneStart({
      phone: body.phone,
      locale: body.locale,
      ctx: this.buildContext(req, correlationId),
    });
    return ok(result);
  }

  @Post('signup/phone/complete')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'PHONE signup — step 2: consume verifiedMobileToken + create customer' })
  async signupPhoneComplete(
    @Body() body: CustomerSignupPhoneCompleteDto,
    @Req() req: MobileRequest,
    @CorrelationId() correlationId: string,
  ): Promise<{ success: true; data: CustomerAuthEnvelopeDto }> {
    const result = await this.mobile.signupPhoneComplete({
      verifiedMobileToken: body.verifiedMobileToken,
      name: body.name,
      email: body.email,
      password: body.password,
      age: body.age,
      ctx: this.buildContext(req, correlationId),
    });
    return ok(this.toEnvelope(result));
  }

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Issue an OTP for SIGNUP / FORGOT_PASSWORD / MOBILE_CHANGE' })
  async otpRequest(
    @Body() body: OtpRequestDto,
    @Req() req: MobileRequest,
    @CorrelationId() correlationId: string,
  ): Promise<unknown> {
    const result = await this.mobile.requestOtp({
      phone: body.phone,
      purpose: body.purpose as OtpPurpose,
      locale: body.locale,
      ctx: this.buildContext(req, correlationId),
    });
    return ok(result);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Verify an OTP. Returns verifiedMobileToken OR passwordResetToken.' })
  async otpVerify(
    @Body() body: OtpVerifyDto,
    @Req() req: MobileRequest,
    @CorrelationId() correlationId: string,
  ): Promise<unknown> {
    const result = await this.mobile.verifyOtp({
      otpId: body.otpId,
      code: body.code,
      purpose: body.purpose as OtpPurpose,
      ctx: this.buildContext(req, correlationId),
    });
    return ok(result);
  }

  @Post('social/google')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({
    summary: 'Verify a Google ID token + create lite SOCIAL customer (or session for returning)',
  })
  async socialGoogle(
    @Body() body: SocialGoogleSignInDto,
    @Req() req: MobileRequest,
    @CorrelationId() correlationId: string,
  ): Promise<unknown> {
    const result = await this.mobile.socialSignIn({
      provider: SocialProvider.GOOGLE,
      idToken: body.idToken,
      ctx: this.buildContext(req, correlationId),
    });
    return ok(this.normalizeSocialResult(result));
  }

  @Post('social/apple')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Verify an Apple ID token + create lite SOCIAL customer (or session)' })
  async socialApple(
    @Body() body: SocialAppleSignInDto,
    @Req() req: MobileRequest,
    @CorrelationId() correlationId: string,
  ): Promise<unknown> {
    const result = await this.mobile.socialSignIn({
      provider: SocialProvider.APPLE,
      idToken: body.idToken,
      userInfo: body.userInfo,
      ctx: this.buildContext(req, correlationId),
    });
    return ok(this.normalizeSocialResult(result));
  }

  @Post('social/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Sign in a returning social customer (consume SocialSession)' })
  async socialLogin(
    @Body() body: SocialLoginDto,
    @Req() req: MobileRequest,
    @CorrelationId() correlationId: string,
  ): Promise<{ success: true; data: CustomerAuthEnvelopeDto }> {
    const result = await this.mobile.socialLogin({
      socialSessionId: body.socialSessionId,
      ctx: this.buildContext(req, correlationId),
    });
    return ok(this.toEnvelope(result));
  }

  @Post('profile/mobile-request-otp')
  @UseGuards(CustomerJwtGuard)
  @ApiBearerAuth('CustomerBearerAuth')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'SOCIAL Complete-Profile — issue OTP for mobile binding' })
  async profileMobileRequestOtp(
    @Body() body: ProfileMobileRequestOtpDto,
    @Req() req: MobileRequest,
    @CorrelationId() correlationId: string,
  ): Promise<unknown> {
    const customerId = this.requireCustomer(req);
    const result = await this.mobile.profileMobileRequestOtp({
      customerId,
      phone: body.phone,
      locale: 'ar',
      ctx: this.buildContext(req, correlationId),
    });
    return ok(result);
  }

  @Post('profile/mobile-verify-otp')
  @UseGuards(CustomerJwtGuard)
  @ApiBearerAuth('CustomerBearerAuth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'SOCIAL Complete-Profile — verify OTP + persist mobile to customer' })
  async profileMobileVerifyOtp(
    @Body() body: ProfileMobileVerifyOtpDto,
    @Req() req: MobileRequest,
    @CorrelationId() correlationId: string,
  ): Promise<void> {
    const customerId = this.requireCustomer(req);
    await this.mobile.profileMobileVerifyOtp({
      customerId,
      otpId: body.otpId,
      code: body.code,
      ctx: this.buildContext(req, correlationId),
    });
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Reset password using a passwordResetToken (PHONE customers only)' })
  async passwordReset(
    @Body() body: PasswordResetDto,
    @Req() req: MobileRequest,
    @CorrelationId() correlationId: string,
  ): Promise<{ success: true; data: CustomerAuthEnvelopeDto }> {
    const result = await this.mobile.resetPassword({
      passwordResetToken: body.passwordResetToken,
      newPassword: body.newPassword,
      ctx: this.buildContext(req, correlationId),
    });
    return ok(this.toEnvelope(result));
  }

  @Post('password/change')
  @UseGuards(CustomerJwtGuard)
  @ApiBearerAuth('CustomerBearerAuth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Change password (authenticated, PHONE customers only)' })
  async passwordChange(
    @Body() body: PasswordChangeDto,
    @Req() req: MobileRequest,
    @CorrelationId() correlationId: string,
  ): Promise<void> {
    const customerId = this.requireCustomer(req);
    await this.mobile.changePassword({
      customerId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      ctx: this.buildContext(req, correlationId),
    });
  }

  // ---- Internals ---------------------------------------------------------

  private normalizeSocialResult(
    result: Awaited<ReturnType<CustomerAuthMobileService['socialSignIn']>>,
  ): unknown {
    return {
      socialSessionId: result.socialSessionId || null,
      provider: result.provider.toLowerCase(),
      profile: result.profile,
      existingCustomer: result.existingCustomer,
      newCustomer: result.newCustomer
        ? { tokens: this.toEnvelope(result.newCustomer.tokens) }
        : null,
    };
  }

  private toEnvelope(
    r: Awaited<ReturnType<CustomerAuthService['login']>>,
  ): CustomerAuthEnvelopeDto {
    return {
      accessToken: r.accessToken,
      accessTokenExpiresIn: r.accessTokenExpiresIn,
      refreshToken: r.refresh.rawToken,
      refreshTokenExpiresIn: r.refresh.ttlSeconds,
      customer: r.customer,
    };
  }

  private buildContext(req: MobileRequest, correlationId: string): CustomerRequestContext {
    return {
      sourceIp: this.readClientIp(req),
      userAgent: this.truncatedUa(req),
      correlationId,
      mobileClientId: null,
    };
  }

  private readClientIp(req: MobileRequest): string {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
      const first = xff.split(',')[0]?.trim();
      if (first && first.length > 0) return first;
    }
    return req.ip ?? '0.0.0.0';
  }

  private truncatedUa(req: MobileRequest): string | null {
    const raw = req.headers['user-agent'];
    if (typeof raw !== 'string') return null;
    return raw.length > 500 ? raw.slice(0, 500) : raw;
  }

  private requireCustomer(req: MobileRequest): string {
    // Passport's customer-jwt strategy attaches the verified payload on req.user.
    const user = (req as Request & { user?: { sub?: string } }).user;
    if (!user?.sub) {
      throw new Error('customer JWT guard did not attach req.user.sub');
    }
    return user.sub;
  }
}
