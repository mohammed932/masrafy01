import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CustomerProfileCompletenessService } from '../customer-profile-completeness.service';

/**
 * Principle XXXVII — hard gate. MUST run AFTER `CustomerJwtGuard` (which
 * attaches `req.user.sub`). Throws `PROFILE_INCOMPLETE` when the authenticated
 * customer has not finished the mandatory profile-completion step. Attach on
 * questionnaire-submit, matching, and `/applications/apply`.
 */
@Injectable()
export class CustomerProfileCompleteGuard implements CanActivate {
  constructor(private readonly completeness: CustomerProfileCompletenessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: { sub?: string } }>();
    const sub = req.user?.sub;
    if (!sub) throw new Error('CustomerProfileCompleteGuard requires CustomerJwtGuard upstream');
    await this.completeness.assertComplete(sub);
    return true;
  }
}
