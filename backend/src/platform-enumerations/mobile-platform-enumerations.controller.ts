import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { MobileHmacGuard } from '@/applications/guards/mobile-hmac.guard';
import { EnumerationRegistryUnavailableException } from '@/common/errors/domain.exceptions';
import {
  EnumerationMember,
  EnumerationType,
  PlatformEnumerationsRepository,
} from './platform-enumerations.repository';

/**
 * Mobile-facing read of the operator-managed enumeration registry.
 * Constitution Principle XIII: HMAC-only (no customer JWT) — these are
 * anonymous catalog reads required to render the wizard, onboarding,
 * and bank-program filters before the user has an account.
 *
 * 5-minute Cache-Control header lets the Flutter client cache between
 * cold starts; the registry is read-mostly and operators update keys
 * in narrow windows.
 */
@ApiTags('Mobile · Platform enumerations')
@UseGuards(MobileHmacGuard)
@SkipThrottle()
@Controller('v1/platform-enumerations')
export class MobilePlatformEnumerationsController {
  constructor(private readonly repo: PlatformEnumerationsRepository) {}

  @Get(':type')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({
    summary: 'List active members of an enumeration type (mobile)',
    description:
      'HMAC-only catalog read. Returns 503 ENUMERATION_REGISTRY_UNAVAILABLE when the registry is unreachable.',
  })
  async list(
    @Param('type') type: EnumerationType,
  ): Promise<{ success: true; data: EnumerationMember[] }> {
    const available = await this.repo.isAvailable();
    if (!available) {
      throw new EnumerationRegistryUnavailableException();
    }
    const members = await this.repo.getActiveMembers(type);
    return { success: true, data: members };
  }
}
