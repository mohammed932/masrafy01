import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { ok } from '@/common/pagination/paginated.response.dto';
import { AuthRefreshInvalidException } from '@/common/errors/domain.exceptions';
import { AuthService, type RequestContext } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { LoginRequestDto } from './dto/login.request.dto';
import { PasswordChangeRequestDto } from './dto/password-change.request.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { McpBypass, McpGuard } from './guards/mcp.guard';
import { Public } from './guards/public.decorator';

@ApiTags('auth')
@Controller('admin/auth')
@UseGuards(JwtAuthGuard, McpGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly refresh: RefreshTokenService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Sign in (issue access token + refresh cookie)' })
  async login(
    @Body() body: LoginRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = this.buildContext(req);
    const result = await this.auth.login(body.email, body.password, ctx);
    this.refresh.setCookie(res, result.refresh.rawToken);
    return ok({
      accessToken: result.accessToken,
      accessTokenExpiresIn: result.accessTokenExpiresIn,
      user: result.user,
    });
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60 * 1000 } })
  @ApiOperation({ summary: 'Rotate refresh token, return fresh access token' })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = this.readRefreshCookie(req);
    if (!raw) {
      this.refresh.clearCookie(res);
      throw new AuthRefreshInvalidException();
    }
    const ctx = this.buildContext(req);
    try {
      const result = await this.auth.refresh(raw, ctx);
      this.refresh.setCookie(res, result.refresh.rawToken);
      return ok({
        accessToken: result.accessToken,
        accessTokenExpiresIn: result.accessTokenExpiresIn,
      });
    } catch (err) {
      this.refresh.clearCookie(res);
      throw err;
    }
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sign out (revoke refresh token, clear cookie)' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const raw = this.readRefreshCookie(req);
    const ctx = this.buildContext(req);
    await this.auth.logout(raw, ctx);
    this.refresh.clearCookie(res);
  }

  @Get('me')
  @ApiBearerAuth('BearerAuth')
  @McpBypass()
  @ApiOperation({ summary: 'Current authenticated user' })
  async me(@CurrentUser() jwt: JwtPayload) {
    const user = await this.auth.me(jwt);
    return ok(user);
  }

  @Patch('password')
  @ApiBearerAuth('BearerAuth')
  @McpBypass()
  @ApiOperation({ summary: 'Change own password (also satisfies forced change)' })
  async changeOwnPassword(
    @CurrentUser() jwt: JwtPayload,
    @Body() body: PasswordChangeRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = this.buildContext(req);
    const result = await this.auth.changePassword({
      jwt,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      ctx,
    });
    this.refresh.setCookie(res, result.refresh.rawToken);
    return ok({
      accessToken: result.accessToken,
      accessTokenExpiresIn: result.accessTokenExpiresIn,
      user: result.user,
    });
  }

  // ---- Internals ---------------------------------------------------------

  private buildContext(req: Request): RequestContext {
    return {
      sourceIp: this.readClientIp(req),
      userAgent: this.truncatedUa(req),
    };
  }

  private readRefreshCookie(req: Request): string | undefined {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    return cookies?.[this.refresh.cookieName()];
  }

  private readClientIp(req: Request): string {
    // Prefer first IP in X-Forwarded-For if a trusted proxy set it.
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
      const first = xff.split(',')[0]?.trim();
      if (first && first.length > 0) return first;
    }
    return req.ip ?? '0.0.0.0';
  }

  private truncatedUa(req: Request): string | null {
    const raw = req.headers['user-agent'];
    if (typeof raw !== 'string') return null;
    return raw.length > 500 ? raw.slice(0, 500) : raw;
  }
}
