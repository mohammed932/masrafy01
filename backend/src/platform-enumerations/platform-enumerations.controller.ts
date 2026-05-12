import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnumerationRegistryUnavailableException } from '../common/errors/domain.exceptions';
import {
  EnumerationMember,
  EnumerationType,
  PlatformEnumerationsRepository,
} from './platform-enumerations.repository';

/**
 * Read-only endpoint feeding the admin dashboard's tier-key pickers.
 * Authenticated; available to all signed-in staff.
 * Spec anchors: FR-010b (dashboard pickers populated from live registry).
 */
@ApiTags('platform-enumerations')
@UseGuards(JwtAuthGuard)
@Controller('admin/platform-enumerations')
export class PlatformEnumerationsController {
  constructor(private readonly repo: PlatformEnumerationsRepository) {}

  @Get(':type')
  @ApiOperation({
    summary: 'List active members of a given enumeration type',
    description:
      'Fail-closed: when the registry is unavailable, returns 503 ENUMERATION_REGISTRY_UNAVAILABLE.',
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
