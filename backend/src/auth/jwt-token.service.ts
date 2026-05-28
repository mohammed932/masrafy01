import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import type { StaffRole } from '@/common/enums/staff-role.enum';
import type { JwtPayload } from '@/common/decorators/current-user.decorator';

const ISS = 'masrafy-admin-api';
const AUD = 'masrafy-admin-dashboard';

export interface AccessTokenClaims {
  sub: string;
  role: StaffRole;
  mcp: boolean;
}

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: NestJwtService,
  ) {}

  signAccessToken(claims: AccessTokenClaims): { token: string; expiresIn: number } {
    const expiresIn = this.config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS');
    const token = this.jwt.sign(
      { ...claims },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        algorithm: 'HS256',
        expiresIn,
        issuer: ISS,
        audience: AUD,
      },
    );
    return { token, expiresIn };
  }

  verifyAccessToken(token: string): JwtPayload {
    const secret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    return this.jwt.verify<JwtPayload>(token, {
      secret,
      algorithms: ['HS256'],
      issuer: ISS,
      audience: AUD,
    });
  }
}
