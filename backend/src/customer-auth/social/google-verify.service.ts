import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';

export interface VerifiedSocialIdentity {
  providerUserId: string;
  email: string | null;
  fullName: string | null;
  emailVerified: boolean;
}

/**
 * Verifies Google ID tokens against Google's public JWK set. Accepts the
 * comma-separated list of iOS + Android client IDs from
 * `GOOGLE_OAUTH_CLIENT_IDS` as the `audience`.
 */
@Injectable()
export class GoogleVerifyService {
  private readonly logger = new Logger(GoogleVerifyService.name);
  private readonly client: OAuth2Client;
  private readonly audiences: string[];

  constructor(config: ConfigService) {
    this.client = new OAuth2Client();
    this.audiences = config
      .getOrThrow<string>('GOOGLE_OAUTH_CLIENT_IDS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async verify(idToken: string): Promise<VerifiedSocialIdentity> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.audiences,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub) throw new DomainException(ERROR_CODES.SOCIAL_TOKEN_INVALID);
      return {
        providerUserId: payload.sub,
        email: payload.email ?? null,
        fullName: payload.name ?? null,
        emailVerified: payload.email_verified === true,
      };
    } catch (err) {
      if (err instanceof DomainException) throw err;
      this.logger.warn({ msg: 'google_id_token_verify_failed', error: String(err) });
      throw new DomainException(ERROR_CODES.SOCIAL_TOKEN_INVALID);
    }
  }
}
