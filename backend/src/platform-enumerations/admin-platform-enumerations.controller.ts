import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { LoanCategory } from '@prisma/client';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { sortCategories } from '@/common/loan-category.util';
import { PlatformEnumerationsAdminService } from './platform-enumerations-admin.service';
import type { EnumerationRow, ProgramNameUsage } from './postgres-platform-enumerations.repository';
import type { BoundQuestion } from './platform-enumerations.repository';
import type { IncomeBasis } from '@/common/income-basis.util';
import {
  CreateEnumerationDto,
  CreateEnumerationTypeDto,
  EnumerationRowDto,
  SetEnumerationBoundQuestionDto,
  SetEnumerationCategoriesBulkDto,
  SetEnumerationParentKeysBulkDto,
  CreateEnumerationValuesBulkDto,
  type EnumerationBulkCreateResult,
  SetEnumerationCategoriesDto,
  SetEnumerationIncomeBasisDto,
  UpdateEnumerationDto,
  UpdateEnumerationTypeDto,
} from './dto/enumeration.dto';

const PROGRAM_NAME_TYPE = 'program_name';

/** The one question-bound type; see `QUESTION_BOUND_ENUMERATION_TYPES`. */
const FACT_TYPE = 'surrogate_fact';

/**
 * A catalog name no bank has instantiated yet. Named rather than inlined because
 * the projector needs the SAME zeroes on every field: a fresh name reporting only
 * `programs: 0` would leave the no-payslip counters undefined, and the list reads
 * that as "unknown", not as "none".
 */
const EMPTY_USAGE: ProgramNameUsage = {
  programs: 0,
  banks: 0,
  noPayslipPrograms: 0,
  noPayslipProgramsWithoutTable: 0,
  // `{}`, not four zeroed categories: a tab with no program says "no bank offers this
  // name here yet", which is the true sentence for a fresh name and a different one
  // from "0 of the programs here read a payslip".
  byCategory: {},
};

@ApiTags('Admin · Platform enumerations')
@ApiBearerAuth()
/**
 * Exempt from the global 100-per-15-minutes throttle, matching both neighbours
 * (`PlatformEnumerationsController`, `AdminQuestionnaireController`) — whose comment already
 * claimed this controller carried the decorator, before it did.
 *
 * The limit is per IP and shared across the whole admin session, so an operator hits it by
 * reloading a values screen six times: the class board alone opens with `GET types`, plus one
 * read per list it shows. What actually constrains this surface is `JwtAuthGuard` +
 * `RolesGuard` + `@Roles('super_admin')` — the narrowest role in the system — and, for the
 * writes, the audit trail and the all-or-nothing transactions. A request ceiling does not
 * meaningfully limit a compromised super-admin token; it only limits a working one.
 */
@SkipThrottle()
@Controller('admin/enumerations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminPlatformEnumerationsController {
  constructor(private readonly service: PlatformEnumerationsAdminService) {}

  @Get('types')
  @ApiOperation({ summary: 'List enumeration types with member counts' })
  async listTypes() {
    const data = await this.service.listTypes();
    return { success: true, data };
  }

  /**
   * Create a KIND of list.
   *
   * All four KIND routes are declared HERE, with the other statics, and before `PATCH :id` /
   * `DELETE :id` further down — `types` is a single segment, so under those routes a request
   * for it resolves as an enumeration whose id is the string "types". The same trap
   * `GET surrogate-products` documents on the bank-programs controller.
   */
  @Post('types')
  @ApiOperation({ summary: 'Create an enumeration type (a KIND of list)' })
  @ApiResponse({ status: 409, description: 'ENUMERATION_TYPE_DUPLICATE' })
  @ApiResponse({ status: 422, description: 'ENUMERATION_TYPE_PARENT_INVALID' })
  async createType(
    @Body() body: CreateEnumerationTypeDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    const data = await this.service.createType(body, { staffId: user.sub, sourceIp: ip ?? null });
    return { success: true, data };
  }

  @Patch('types/:key')
  @ApiOperation({ summary: 'Update an enumeration type. The key itself is immutable.' })
  @ApiResponse({ status: 404, description: 'ENUMERATION_TYPE_NOT_FOUND' })
  @ApiResponse({ status: 422, description: 'ENUMERATION_TYPE_SYSTEM_ONLY' })
  async updateType(
    @Param('key') key: string,
    @Body() body: UpdateEnumerationTypeDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    const data = await this.service.updateType(key, body, {
      staffId: user.sub,
      sourceIp: ip ?? null,
    });
    return { success: true, data };
  }

  @Delete('types/:key')
  @ApiOperation({ summary: 'Delete an enumeration type that holds no values' })
  @ApiResponse({ status: 404, description: 'ENUMERATION_TYPE_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'ENUMERATION_TYPE_IN_USE' })
  @ApiResponse({ status: 422, description: 'ENUMERATION_TYPE_SYSTEM_ONLY' })
  async deleteType(
    @Param('key') key: string,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    await this.service.deleteType(key, { staffId: user.sub, sourceIp: ip ?? null });
    return { success: true, data: { key } };
  }

  @Get()
  @ApiOperation({ summary: 'List enumeration members (optionally filtered by type)' })
  async list(@Query('type') type?: string): Promise<{ success: true; data: EnumerationRowDto[] }> {
    const rows = await this.service.listAll({ type });
    // Usage, loan-category assignment and income basis are all meaningful only for the
    // program catalog, and three extra queries for the whole page beat three per row.
    const isCatalog = type === PROGRAM_NAME_TYPE || rows.some((r) => r.type === PROGRAM_NAME_TYPE);
    const projectCatalog = isCatalog ? await this.catalogProjector() : null;
    // Same one-query-per-page rule as the catalog's three side reads: a fact row is
    // unreadable without the question it binds, and per-row lookups would be one query
    // per fact for a list that is normally the whole registry.
    const hasFacts = type === FACT_TYPE || rows.some((r) => r.type === FACT_TYPE);
    const bound = hasFacts ? await this.service.boundQuestions({ type: FACT_TYPE }) : null;
    return {
      success: true,
      data: rows.map((r) => {
        if (r.type === PROGRAM_NAME_TYPE && projectCatalog) return projectCatalog(r);
        // `?? null` rather than leaving it absent: on a fact row, "no binding" is a
        // state the screen must render (and offer to fix), not a field that does not
        // apply — which is what an absent key means everywhere else in this projection.
        if (r.type === FACT_TYPE && bound) {
          return this.project(r, { boundQuestion: bound.get(r.id) ?? null });
        }
        return this.project(r);
      }),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new enumeration member' })
  async create(
    @Body() body: CreateEnumerationDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    const created = await this.service.create(body, {
      staffId: user.sub,
      sourceIp: ip ?? null,
    });
    return { success: true, data: this.project(created) };
  }

  // Static segment declared BEFORE any `:id` route at the same depth, so a
  // future `@Post(':id/...')` cannot shadow it — the same defensive posture as
  // the questionnaire's bulk endpoint.
  @Post('categories')
  @ApiOperation({ summary: 'Reassign loan categories for many entries in one transaction' })
  async setCategoriesBulk(
    @Body() body: SetEnumerationCategoriesBulkDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ): Promise<{ success: true; data: EnumerationRowDto[] }> {
    const rows = await this.service.setCategoriesBulk(body.assignments, {
      staffId: user.sub,
      sourceIp: ip ?? null,
    });
    const projectCatalog = await this.catalogProjector();
    return { success: true, data: rows.map(projectCatalog) };
  }

  // Second static segment, declared before the `:id` routes for the same reason as
  // `categories` above.
  @Post('parent-keys')
  @ApiOperation({
    summary: 'Re-file many entries onto a parent list entry in one transaction',
    description:
      'Named for the generic axis rather than for compounds: the class board is one client of ' +
      'a registry-wide column. Every id is resolved and every target validated before anything ' +
      'is written, and one audit event is written per entry that actually moved.',
  })
  async setParentKeysBulk(
    @Body() body: SetEnumerationParentKeysBulkDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ): Promise<{ success: true; data: { moved: number } }> {
    const data = await this.service.setParentKeysBulk(body, {
      staffId: user.sub,
      sourceIp: ip ?? null,
    });
    return { success: true, data };
  }

  // Third static segment, declared before the `:id` routes for the same reason as the two
  // above: `values` would otherwise resolve as an id.
  @Post('values')
  @ApiOperation({
    summary: 'Create many values of one list in one transaction',
    description:
      'What a pasted list saves. ALL-OR-NOTHING: every bad row is reported at once via ' +
      '`meta.problems[].index` (ZERO-BASED into `rows`; the screen adds one to name a line), ' +
      'and nothing is written. Keys are slugged from `labelEn` server-side, so re-pasting the ' +
      'same sheet writes nothing and reports every row as skipped. A mirrored list is re-synced ' +
      'and the questionnaire republished ONCE, after the commit — not once per row, which is ' +
      'the whole reason this exists rather than a client loop.',
  })
  async createValuesBulk(
    @Body() body: CreateEnumerationValuesBulkDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ): Promise<{ success: true; data: EnumerationBulkCreateResult }> {
    const data = await this.service.createValuesBulk(body, {
      staffId: user.sub,
      sourceIp: ip ?? null,
    });
    return { success: true, data };
  }

  @Put(':id/categories')
  @ApiOperation({ summary: 'Replace one entry’s loan-category assignment (empty array = parked)' })
  async setCategories(
    @Param('id') id: string,
    @Body() body: SetEnumerationCategoriesDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ): Promise<{ success: true; data: EnumerationRowDto }> {
    const row = await this.service.setCategories(id, body.categories, {
      staffId: user.sub,
      sourceIp: ip ?? null,
    });
    const projectCatalog = await this.catalogProjector();
    return { success: true, data: projectCatalog(row) };
  }

  /**
   * Replace one (name, category) pair's INCOME BASIS — how the catalog says the name
   * is meant to be sold under that loan type: against a payslip, without one, or both.
   *
   * A statement of intent, NOT a constraint: nothing in the bank-program write path
   * reads it, so it can never refuse a program the bank is entitled to save. What the
   * banks actually did is counted separately (`usage.byCategory`).
   *
   * Its own endpoint rather than a field on `PUT :id/categories`: that array's empty
   * case means "parked", and a per-pair attribute cannot ride a whole-set replacement
   * without inventing a rule for pairs the submitted set adds or drops.
   *
   * The category rides in the BODY, not the path — it names which of the entry's tabs
   * this write lands on, not a sub-resource.
   */
  @Put(':id/income-basis')
  @ApiOperation({ summary: 'Replace one catalog name’s income basis for one loan category' })
  async setIncomeBasis(
    @Param('id') id: string,
    @Body() body: SetEnumerationIncomeBasisDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ): Promise<{ success: true; data: EnumerationRowDto }> {
    const row = await this.service.setIncomeBases(id, body.category, body.bases, {
      staffId: user.sub,
      sourceIp: ip ?? null,
    });
    const projectCatalog = await this.catalogProjector();
    return { success: true, data: projectCatalog(row) };
  }

  /**
   * Point one surrogate FACT at the question that answers it, or unbind it.
   *
   * Its own endpoint rather than a field on `PATCH :id`, for the reason the two
   * assignment axes have theirs: that route is a label/flag patch whose diff the audit
   * writes as scalar changes, while this one has its own validation (the question must
   * exist and be of a type a table can be keyed by) and its own audit key.
   */
  @Put(':id/bound-question')
  @ApiOperation({ summary: 'Bind a surrogate fact to the question that answers it' })
  async setBoundQuestion(
    @Param('id') id: string,
    @Body() body: SetEnumerationBoundQuestionDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ): Promise<{ success: true; data: EnumerationRowDto }> {
    const row = await this.service.setBoundQuestion(id, body.questionCode ?? null, {
      staffId: user.sub,
      sourceIp: ip ?? null,
    });
    const bound = await this.service.boundQuestions({ type: row.type });
    return { success: true, data: this.project(row, { boundQuestion: bound.get(row.id) ?? null }) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update label / active / deprecate / sort order' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateEnumerationDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    const updated = await this.service.update(id, body, {
      staffId: user.sub,
      sourceIp: ip ?? null,
    });
    return { success: true, data: this.project(updated) };
  }

  /**
   * Hard-delete a registry entry. Refuses a value anything still points at (409
   * `ENUMERATION_IN_USE`) — deprecate those instead — a `systemOnly` row, and any
   * type whose readers are not counted (422 `ENUMERATION_DELETE_NOT_SUPPORTED`).
   *
   * Returns the id rather than 204, matching `DELETE /admin/banks/:id`: the
   * envelope is the platform's contract (Principle XIV) and a bodiless success
   * would be the one response the admin client cannot read through it.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an enumeration entry (refuses if anything still uses it)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ): Promise<{ success: true; data: { id: string } }> {
    await this.service.remove(id, { staffId: user.sub, sourceIp: ip ?? null });
    return { success: true, data: { id } };
  }

  /**
   * Loads the three catalog-only side reads ONCE and returns the projector every
   * handler here used to hand-roll.
   *
   * Four copies of "fetch usage + categories + template, then spread them onto
   * the row" is four chances to forget one and silently return a row whose
   * `categories` is absent — which the admin reads as "this type has no such
   * axis", not as "we forgot", so the bug shows up as an empty picker rather than
   * an error. The write handlers deliberately re-read rather than echoing back
   * what they just wrote, so one shape comes out of every endpoint.
   */
  private async catalogProjector(): Promise<
    (row: Parameters<AdminPlatformEnumerationsController['project']>[0]) => EnumerationRowDto
  > {
    const [usage, categories, bases] = await Promise.all([
      this.service.programNameUsage(),
      this.service.categoryAssignments({ type: PROGRAM_NAME_TYPE }),
      this.service.incomeBasisAssignments({ type: PROGRAM_NAME_TYPE }),
    ]);
    return (row) =>
      this.project(row, {
        usage: usage.get(row.key) ?? EMPTY_USAGE,
        categories: [...sortCategories(categories.get(row.id) ?? [])],
        incomeBasesByCategory: bases.get(row.id) ?? {},
      });
  }

  private project(
    // The repository's own row type, not a structural copy of it. The copy this replaces
    // had to be edited in step with the interface, and a field added to one and not the
    // other fails here rather than where it is read.
    row: EnumerationRow,
    // One `extras` bag rather than a fourth positional — the catalog now
    // attaches three optional things and the next one would be unreadable.
    extras: {
      usage?: ProgramNameUsage;
      categories?: LoanCategory[];
      incomeBasesByCategory?: Partial<Record<LoanCategory, IncomeBasis[]>>;
      /** `null` = this fact binds nothing yet; absent = this type binds nothing ever. */
      boundQuestion?: BoundQuestion | null;
    } = {},
  ): EnumerationRowDto {
    const { usage, categories, incomeBasesByCategory, boundQuestion } = extras;
    return {
      id: row.id,
      type: row.type,
      key: row.key,
      labelAr: row.labelAr,
      labelEn: row.labelEn,
      active: row.active,
      deprecatedAt: row.deprecatedAt?.toISOString() ?? null,
      systemOnly: row.systemOnly,
      parentKey: row.parentKey,
      surrogateProductKey: row.surrogateProductKey,
      // Unconditional, like the link above it and for the same reason: the board reads the
      // two together, and a field that is sometimes absent reads as `false` — i.e. as the
      // one state ("quotes nothing") the operator is meant to go and fix.
      hasOwnIncomeRule: row.hasOwnIncomeRule,
      ...(usage ? { usage } : {}),
      // Spread conditionally, like `usage`: absent means "this type has no such
      // axis", while a present `[]` means parked. Collapsing the two would make
      // every governorate row read as deliberately offerable nowhere.
      ...(categories ? { categories } : {}),
      // Same rule again: absent = this type has no income basis; present and keyed
      // only by the categories the name is actually offered under.
      ...(incomeBasesByCategory ? { incomeBasesByCategory } : {}),
      // `!== undefined`, not truthiness: `null` is the state that MUST reach the client
      // — a fact bound to nothing — and a truthy check would erase it into "this type
      // has no binding", which is the one reading that hides the problem.
      ...(boundQuestion !== undefined
        ? {
            boundQuestion: boundQuestion
              ? {
                  code: boundQuestion.code,
                  type: boundQuestion.type,
                  labelAr: boundQuestion.labelAr,
                  labelEn: boundQuestion.labelEn,
                  active: boundQuestion.active,
                }
              : null,
          }
        : {}),
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
