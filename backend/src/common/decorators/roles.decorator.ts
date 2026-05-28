import { SetMetadata } from '@nestjs/common';
import type { StaffRole } from '@/common/enums/staff-role.enum';

export const ROLES_METADATA_KEY = 'roles_required';

/**
 * Mark a controller method (or whole controller class) as requiring one of the
 * listed roles. RolesGuard reads the metadata and rejects requests whose JWT
 * role is not in the allowed set with code `FORBIDDEN`.
 *
 *   @Roles('super_admin')                                  // single
 *   @Roles('super_admin', 'sales_manager')                  // any-of
 *
 * Role matrix (default — tighten per route as features land):
 *   super_admin    — full access (user management + everything below)
 *   sales_manager  — applications + bank-program writes + team analytics
 *   sales_agent    — applications (read/write, scoped to ownership)
 *   analyst        — read-only across applications + programs + audit
 */
export const Roles = (...roles: StaffRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_METADATA_KEY, roles);
