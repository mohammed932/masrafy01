import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LoanCategory } from '@prisma/client';
import { CustomerJwtGuard } from '@/customer-auth/guards/customer-jwt.guard';
import { CustomerProfileCompleteGuard } from '@/customer-auth/guards/customer-profile-complete.guard';
import { ok } from '@/common/pagination/paginated.response.dto';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { ProgramNameScopeService } from '@/platform-enumerations/program-name-scope.service';
import { QuestionnaireService } from './questionnaire.service';
import { parseCategory } from './category.util';

/**
 * Mobile-facing questionnaire fetch. JWT-gated, no guest (v4.0.0), and
 * profile-complete-gated (Principle XXXVII) like matching + apply: an incomplete
 * profile gets PROFILE_INCOMPLETE.
 *
 * Returns the single active published snapshot. The question POOL stays global —
 * one canonical list, one version — but each question is assigned to one or more
 * loan categories in the dashboard, so `?category=` narrows the snapshot to the
 * questions that category actually asks. Omitting it returns the whole pool
 * (the pre-assignment behaviour), which keeps an older client working.
 *
 * `?programNameKey=` narrows once more, to the program the applicant picked: of the
 * questions their category asks, the ones a program behind that name can actually be
 * quoted from, plus the core every quote needs. One program may need three questions and
 * the next fifteen, and this is where that difference reaches the applicant. Omitting it
 * returns the whole category, which is what every client shipped before this parameter
 * existed does — and what makes narrowing safe to deploy ahead of an app release.
 */
@ApiTags('Mobile · Questionnaire')
@ApiBearerAuth('CustomerBearerAuth')
@Controller('v1/questionnaire')
@UseGuards(CustomerJwtGuard, CustomerProfileCompleteGuard)
export class QuestionnaireController {
  constructor(
    private readonly service: QuestionnaireService,
    /**
     * The SAME validator apply and preview call, so the three surfaces accept exactly the
     * same (name, category) pairs. Injected here rather than into the service so the
     * service's constructor — which four specs build by hand — is untouched.
     */
    private readonly programNames: ProgramNameScopeService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Active questionnaire snapshot, narrowed to a loan category and program name',
  })
  @ApiQuery({
    name: 'category',
    enum: LoanCategory,
    required: false,
    description: 'Omit to receive every question in the pool',
  })
  @ApiQuery({
    name: 'programNameKey',
    type: String,
    required: false,
    description:
      'Catalog program name the applicant picked. Narrows the served and required set to ' +
      'the questions a program behind it reads, plus the shared core. Requires `category`. ' +
      'Omit for every question the category asks.',
  })
  async getActive(
    @Query('category') category?: string,
    @Query('programNameKey') programNameKey?: string,
  ): Promise<{ success: true; data: unknown }> {
    // An unknown value is rejected rather than silently ignored: falling back to
    // the full pool would ask the applicant questions their category never asks.
    const parsed = category === undefined ? undefined : parseCategory(category);
    if (programNameKey !== undefined) {
      // A catalog name is offered UNDER categories, so narrowing by one without saying which
      // is unanswerable. Same field and same reason apply raises.
      if (parsed === undefined) {
        throw new DomainException(ERROR_CODES.VALIDATION_FAILED, {
          field: 'programNameKey',
          reason: 'category_required',
        });
      }
      // Loud on an unknown or wrongly-scoped name, never a quiet fall back to the whole
      // pool: a narrow that silently did not happen reads as one that did.
      await this.programNames.assertOfferedUnder(programNameKey, parsed);
    }
    const snapshot = await this.service.activeSnapshot(parsed, programNameKey);
    return ok(snapshot);
  }
}
