import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { CustomerJwtGuard } from '@/customer-auth/guards/customer-jwt.guard';
import { EnumerationRegistryUnavailableException } from '@/common/errors/domain.exceptions';
import {
  EnumerationMember,
  EnumerationType,
  PlatformEnumerationsRepository,
} from './platform-enumerations.repository';

/**
 * Mobile-facing read of the operator-managed enumeration registry.
 * Constitution v3.0.0 / Principle XIII: customer-JWT only — every reachable
 * in-app feature, including the catalog reads used to render the wizard,
 * onboarding, and bank-program filters, requires an authenticated customer.
 *
 * 5-minute Cache-Control header lets the Flutter client cache between
 * cold starts; the registry is read-mostly and operators update keys
 * in narrow windows.
 */
@ApiTags('Mobile · Platform enumerations')
@ApiBearerAuth('CustomerBearerAuth')
@UseGuards(CustomerJwtGuard)
@SkipThrottle()
@Controller('v1/platform-enumerations')
export class MobilePlatformEnumerationsController {
  constructor(private readonly repo: PlatformEnumerationsRepository) {}

  @Get(':type')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({
    summary: 'List active members of an enumeration type (mobile)',
    description:
      'Customer-JWT catalog read. Returns 503 ENUMERATION_REGISTRY_UNAVAILABLE when the registry is unreachable.',
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
