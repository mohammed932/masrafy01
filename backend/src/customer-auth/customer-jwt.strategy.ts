import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { CustomerJwtPayload } from './dto/customer-auth.dto';

@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(Strategy, 'customer-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('CUSTOMER_JWT_ACCESS_SECRET'),
      algorithms: ['HS256'],
      issuer: 'masrafy-mobile-api',
      audience: 'masrafy-mobile-customer',
    });
  }

  validate(payload: CustomerJwtPayload): CustomerJwtPayload {
    return payload;
  }
}
