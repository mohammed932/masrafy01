import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '@/common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      algorithms: ['HS256'],
      issuer: 'masrafy-admin-api',
      audience: 'masrafy-admin-dashboard',
    });
  }

  /**
   * Passport already verified signature, exp, iss, aud. The returned object
   * becomes `req.user` and is read by CurrentUser / guards.
   */
  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
