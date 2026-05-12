import { SetMetadata } from '@nestjs/common';
import type { StaffRole } from '@prisma/client';

export const ROLES_METADATA_KEY = 'roles_required';

/**
 * Mark a controller method (or whole controller class) as requiring one of the
 * listed roles. RolesGuard reads the metadata and rejects requests whose JWT
 * role is not in the allowed set with code `FORBIDDEN`.
 *
 *   @Roles('SUPER_ADMIN')                           // single
 *   @Roles('SUPER_ADMIN', 'ADMIN')                  // any-of
 */
export const Roles = (...roles: StaffRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_METADATA_KEY, roles);
