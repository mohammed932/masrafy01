import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import type { VerifiedSocialIdentity } from './google-verify.service';

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

/**
 * Verifies Apple ID tokens against Apple's public JWK set (cached by jose).
 * Apple-specific quirk: `email` is only present on the FIRST sign-in. The
 * caller persists email keyed by `providerUserId` (the `sub` claim) and
 * trusts the first-contact email on subsequent sign-ins.
 *
 * The optional first-contact `userInfo` payload (name + email) is consumed
 * by the controller separately when provided by the mobile client.
 */
@Injectable()
export class AppleVerifyService {
  private readonly logger = new Logger(AppleVerifyService.name);
  private readonly jwks = createRemoteJWKSet(new URL(APPLE_JWKS_URL));
  private readonly audience: string;

  constructor(config: ConfigService) {
    this.audience = config.getOrThrow<string>('APPLE_BUNDLE_ID');
  }

  async verify(idToken: string): Promise<VerifiedSocialIdentity> {
    try {
      const { payload } = await jwtVerify(idToken, this.jwks, {
        issuer: 'https://appleid.apple.com',
        audience: this.audience,
      });
      const sub = typeof payload.sub === 'string' ? payload.sub : null;
      if (!sub) throw new DomainException(ERROR_CODES.SOCIAL_TOKEN_INVALID);
      return {
        providerUserId: sub,
        email: typeof payload.email === 'string' ? payload.email : null,
        fullName: null, // Apple does not include name in the idToken — comes via userInfo.
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      };
    } catch (err) {
      if (err instanceof DomainException) throw err;
      this.logger.warn({ msg: 'apple_id_token_verify_failed', error: String(err) });
      throw new DomainException(ERROR_CODES.SOCIAL_TOKEN_INVALID);
    }
  }
}
