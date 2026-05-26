import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import type { CustomerJwtPayload } from './dto/customer-auth.dto';

const ISS = 'masrafy-mobile-api';
const AUD = 'masrafy-mobile-customer';

@Injectable()
export class CustomerJwtTokenService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: NestJwtService,
  ) {}

  signAccessToken(claims: { sub: string }): { token: string; expiresIn: number } {
    const expiresIn = this.config.getOrThrow<number>('CUSTOMER_JWT_ACCESS_TTL_SECONDS');
    const token = this.jwt.sign(
      { sub: claims.sub, typ: 'customer' satisfies CustomerJwtPayload['typ'] },
      {
        secret: this.config.getOrThrow<string>('CUSTOMER_JWT_ACCESS_SECRET'),
        algorithm: 'HS256',
        expiresIn,
        issuer: ISS,
        audience: AUD,
      },
    );
    return { token, expiresIn };
  }

  verifyAccessToken(token: string): CustomerJwtPayload {
    const secret = this.config.getOrThrow<string>('CUSTOMER_JWT_ACCESS_SECRET');
    return this.jwt.verify<CustomerJwtPayload>(token, {
      secret,
      algorithms: ['HS256'],
      issuer: ISS,
      audience: AUD,
    });
  }
}
