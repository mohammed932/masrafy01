import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
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
} from './dto/customer-auth.dto';
import { OtpRequestDto, OtpVerifyDto } from './dto/customer-otp.dto';
import {
  CustomerSignupPhoneStartDto,
  CustomerSignupPhoneVerifyDto,
} from './dto/customer-signup-phone.dto';
import { CustomerCompleteProfileDto } from './dto/customer-complete-profile.dto';
import { UpdateCustomerProfileDto } from './dto/customer-update-profile.dto';
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

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Log in with email + password (feature 008: with lockout per FR-022)' })
  async login(
    @Body() body: CustomerLoginRequestDto,
    @Req() req: MobileRequest,
  ): Promise<{ success: true; data: CustomerAuthEnvelopeDto }> {
    const result = await this.mobile.loginWithLockout({
      email: body.email,
      password: body.password,
      ctx: this.buildContext(req),
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
  ): Promise<{ success: true; data: CustomerAuthEnvelopeDto }> {
    const result = await this.svc.refresh({
      refreshToken: body.refreshToken,
      ctx: this.buildContext(req),
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
  ): Promise<void> {
    const customerId = this.requireCustomer(req);
    await this.svc.logout({
      refreshToken: body.refreshToken,
      customerId,
      ctx: this.buildContext(req),
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
  // Two-Path Registration endpoints (Constitution v4.0.0 / Principle XIII+XXXVII).
  // Both paths create a LITE customer (post-OTP/provider) then finalize via the
  // mandatory profile-completion step `POST /profile/complete`. No guest mode,
  // no claim endpoint.
  // -------------------------------------------------------------------------

  @Post('signup/phone/start')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'PHONE signup — step 1: request OTP for new phone' })
  async signupPhoneStart(
    @Body() body: CustomerSignupPhoneStartDto,
    @Req() req: MobileRequest,
  ): Promise<unknown> {
    const result = await this.mobile.signupPhoneStart({
      phone: body.phone,
      locale: body.locale,
      ctx: this.buildContext(req),
    });
    return ok(result);
  }

  @Post('signup/phone/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiOperation({
    summary: 'PHONE signup — step 2: consume verifiedMobileToken + create LITE customer + issue tokens',
  })
  async signupPhoneVerify(
    @Body() body: CustomerSignupPhoneVerifyDto,
    @Req() req: MobileRequest,
  ): Promise<{ success: true; data: CustomerAuthEnvelopeDto }> {
    const result = await this.mobile.signupPhoneVerify({
      verifiedMobileToken: body.verifiedMobileToken,
      locale: body.locale,
      ctx: this.buildContext(req),
    });
    return ok(this.toEnvelope(result));
  }

  @Post('profile/complete')
  @UseGuards(CustomerJwtGuard)
  @ApiBearerAuth('CustomerBearerAuth')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({
    summary:
      'Mandatory profile completion (Principle XXXVII) — firstName/lastName/birthday (+password for PHONE). Profile photo + National ID front/back are optional and independent of this call.',
  })
  async completeProfile(
    @Body() body: CustomerCompleteProfileDto,
    @Req() req: MobileRequest,
  ): Promise<{ success: true; data: CustomerAuthEnvelopeDto }> {
    const customerId = this.requireCustomer(req);
    const result = await this.mobile.completeProfile({
      customerId,
      firstName: body.firstName,
      lastName: body.lastName,
      birthday: body.birthday,
      email: body.email,
      password: body.password,
      ctx: this.buildContext(req),
    });
    return ok(this.toEnvelope(result));
  }

  @Patch('profile')
  @UseGuards(CustomerJwtGuard)
  @ApiBearerAuth('CustomerBearerAuth')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 15 * 60 * 1000 } })
  @ApiOperation({
    summary:
      'Edit profile scalars (firstName/lastName/email/governorate/city/address). Never phone, birthday, or password. Returns the fresh profile.',
  })
  async updateProfile(
    @Body() body: UpdateCustomerProfileDto,
    @Req() req: MobileRequest,
  ): Promise<{ success: true; data: CustomerProfileResponseDto }> {
    const customerId = this.requireCustomer(req);
    await this.mobile.updateProfile({
      customerId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      governorate: body.governorate,
      city: body.city,
      address: body.address,
      ctx: this.buildContext(req),
    });
    const profile = await this.svc.me(customerId);
    return ok(profile);
  }

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Issue an OTP for SIGNUP / FORGOT_PASSWORD / MOBILE_CHANGE' })
  async otpRequest(
    @Body() body: OtpRequestDto,
    @Req() req: MobileRequest,
  ): Promise<unknown> {
    const result = await this.mobile.requestOtp({
      phone: body.phone,
      purpose: body.purpose as OtpPurpose,
      locale: body.locale,
      ctx: this.buildContext(req),
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
  ): Promise<unknown> {
    const result = await this.mobile.verifyOtp({
      otpId: body.otpId,
      code: body.code,
      purpose: body.purpose as OtpPurpose,
      ctx: this.buildContext(req),
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
  ): Promise<unknown> {
    const result = await this.mobile.socialSignIn({
      provider: SocialProvider.GOOGLE,
      idToken: body.idToken,
      ctx: this.buildContext(req),
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
  ): Promise<unknown> {
    const result = await this.mobile.socialSignIn({
      provider: SocialProvider.APPLE,
      idToken: body.idToken,
      userInfo: body.userInfo,
      ctx: this.buildContext(req),
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
  ): Promise<{ success: true; data: CustomerAuthEnvelopeDto }> {
    const result = await this.mobile.socialLogin({
      socialSessionId: body.socialSessionId,
      ctx: this.buildContext(req),
    });
    return ok(this.toEnvelope(result));
  }

  @Post('google/signin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({
    summary: 'Sign in with Google — verify ID token + issue tokens directly (new or returning)',
  })
  async googleSignin(
    @Body() body: SocialGoogleSignInDto,
    @Req() req: MobileRequest,
  ): Promise<{ success: true; data: CustomerAuthEnvelopeDto }> {
    const result = await this.mobile.socialAuthDirect({
      provider: SocialProvider.GOOGLE,
      idToken: body.idToken,
      ctx: this.buildContext(req),
    });
    return ok(this.toEnvelope(result));
  }

  @Post('apple/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({
    summary: 'Log in with Apple — verify ID token + issue tokens directly (new or returning)',
  })
  async appleLogin(
    @Body() body: SocialAppleSignInDto,
    @Req() req: MobileRequest,
  ): Promise<{ success: true; data: CustomerAuthEnvelopeDto }> {
    const result = await this.mobile.socialAuthDirect({
      provider: SocialProvider.APPLE,
      idToken: body.idToken,
      userInfo: body.userInfo,
      ctx: this.buildContext(req),
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
  ): Promise<unknown> {
    const customerId = this.requireCustomer(req);
    const result = await this.mobile.profileMobileRequestOtp({
      customerId,
      phone: body.phone,
      locale: 'ar',
      ctx: this.buildContext(req),
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
  ): Promise<void> {
    const customerId = this.requireCustomer(req);
    await this.mobile.profileMobileVerifyOtp({
      customerId,
      otpId: body.otpId,
      code: body.code,
      ctx: this.buildContext(req),
    });
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Reset password using a passwordResetToken (PHONE customers only)' })
  async passwordReset(
    @Body() body: PasswordResetDto,
    @Req() req: MobileRequest,
  ): Promise<{ success: true; data: CustomerAuthEnvelopeDto }> {
    const result = await this.mobile.resetPassword({
      passwordResetToken: body.passwordResetToken,
      newPassword: body.newPassword,
      ctx: this.buildContext(req),
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
  ): Promise<void> {
    const customerId = this.requireCustomer(req);
    await this.mobile.changePassword({
      customerId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      ctx: this.buildContext(req),
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
      refreshToken: r.refresh.rawToken,
      customer: r.customer,
    };
  }

  private buildContext(req: MobileRequest): CustomerRequestContext {
    return {
      sourceIp: this.readClientIp(req),
      userAgent: this.truncatedUa(req),
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
