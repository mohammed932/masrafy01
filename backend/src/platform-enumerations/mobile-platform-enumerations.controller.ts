import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { CustomerJwtGuard } from '@/customer-auth/guards/customer-jwt.guard';
import { DomainException, EnumerationRegistryUnavailableException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import {
  CUSTOMER_READABLE_ENUMERATION_TYPES,
  EnumerationMember,
  EnumerationType,
  isCustomerReadableEnumerationType,
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
    // Checked BEFORE `isAvailable()`, so an off-list type gets the same answer whether
    // or not the registry happens to be up. A 503 on a request that was never going to
    // be served reads as "try again", which is the wrong thing to tell a caller asking
    // for something they may not have.
    if (!isCustomerReadableEnumerationType(type)) {
      throw new DomainException(ERROR_CODES.VALIDATION_FAILED, {
        field: 'type',
        allowed: CUSTOMER_READABLE_ENUMERATION_TYPES,
      });
    }

    const available = await this.repo.isAvailable();
    if (!available) {
      throw new EnumerationRegistryUnavailableException();
    }
    const members = await this.repo.getActiveMembers(type);
    return { success: true, data: members };
  }
}
