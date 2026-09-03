import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator';
import { ok, okPaginated } from '../common/pagination/paginated.response.dto';
import { CreateBankProgramDto } from './dto/create-bank-program.dto';
import { UpdateBankProgramDto } from './dto/update-bank-program.dto';
import { ToggleBankProgramDto } from './dto/toggle-bank-program.dto';
import { ListBankProgramsQuery } from './dto/list-bank-programs.query';
import { DuplicateBankProgramDto } from './dto/duplicate-bank-program.dto';
import { IncomeRuleCheckDto, IncomeRuleDraftCheckDto } from './dto/income-rule-check.dto';
import {
  SetProgramNameIncomeRuleDto,
  SetSurrogateProductActiveDto,
  SetSurrogateProductTemplateDto,
} from './dto/program-name-income-rule.dto';
import { BankProgramsService } from './bank-programs.service';
import { BlueprintService } from './blueprints/blueprint.service';
import { ProductAsksService } from './asks/product-asks.service';
import { AttachProductAskDto } from './dto/product-asks.dto';
import { BankProgramNotFoundException } from '../common/errors/domain.exceptions';

interface ActorCtx {
  id: string;
  sourceIp: string | null;
}

@ApiTags('bank-programs-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/bank-programs')
export class BankProgramsController {
  constructor(
    private readonly service: BankProgramsService,
    private readonly blueprints: BlueprintService,
    private readonly asks: ProductAsksService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List bank programs (paginated, filterable, searchable)' })
  @ApiResponse({ status: 200, description: 'Paginated list of bank programs.' })
  async list(@Query() query: ListBankProgramsQuery) {
    const result = await this.service.list(query);
    return okPaginated(
      result.rows,
      result.pagination.page,
      result.pagination.pageSize,
      result.pagination.totalCount,
    );
  }

  /**
   * The surrogate-product library — the pre-defined no-payslip products a catalog name
   * links to.
   *
   * On THIS controller, beside the program-name pair above and for the identical reason:
   * everything that decides whether a calculation is acceptable lives in this module, and
   * moving the check into `platform-enumerations` would make the two circular. The rows
   * are enumerations; the RULES on them are bank-program machinery.
   *
   * DECLARED BEFORE `@Get(':programCode')`, and it has to be. Nest matches in
   * declaration order and `:programCode` is a single segment, so below it every request
   * for `surrogate-products` resolves as a bank program with that code and comes back
   * `BANK_PROGRAM_NOT_FOUND` — which is what it did. The `program-names/...` routes
   * escape this only by being three segments deep.
   */
  @Get('surrogate-products')
  @Roles('super_admin', 'sales_manager')
  @ApiOperation({
    summary: 'Every surrogate product, with the proof it reads and the names that sell it',
  })
  async listSurrogateProducts() {
    return ok(await this.service.listSurrogateProducts());
  }

  /**
   * The starter shapes an operator picks from when creating a product.
   *
   * SHAPES ONLY — no labels, no examples, no figures. The admin names them from its own
   * dictionary in both locales; an English label on this response would be English on the
   * wire (Principle III / A2).
   *
   * Declared before `surrogate-products/:key` for the reason the whole block is declared
   * before `:programCode`: a single-segment param below it would swallow this path.
   */
  @Get('surrogate-product-templates')
  @Roles('super_admin', 'sales_manager')
  @ApiOperation({ summary: 'The starter shapes for a no-payslip product' })
  listSurrogateProductTemplates() {
    return ok(this.service.surrogateProductTemplateStarters());
  }

  /**
   * The predefined products — one entry per product, with what each would have to CREATE.
   *
   * Declared with the rest of the `surrogate-product*` block and before
   * `surrogate-products/:key`, for the reason that block states: a single-segment param
   * below would swallow this path.
   */
  @Get('product-blueprints')
  @Roles('super_admin', 'sales_manager')
  @ApiOperation({
    summary: 'The predefined no-payslip products, and what each one still needs set up',
    description:
      'Structure and existence only. The product names are the DEFAULT for the name box; ' +
      "every other word an operator reads is the admin bundle's, keyed by these keys.",
  })
  async listProductBlueprints() {
    return ok(await this.blueprints.list());
  }

  @Get('surrogate-products/:key/template')
  @Roles('super_admin', 'sales_manager')
  @ApiOperation({
    summary: 'The friendly form behind a product, and what it compiles to',
    description:
      'Returns `advanced: true` rather than an error when the calculation was authored ' +
      'through the raw step editor: the screen has to SAY that, and a refusal on a read ' +
      'would leave it with nothing to say it about.',
  })
  @ApiResponse({ status: 404, description: 'SURROGATE_PRODUCT_NOT_FOUND' })
  async getSurrogateProductTemplate(@Param('key') key: string) {
    return ok(await this.service.getSurrogateProductTemplate(key));
  }

  @Put('surrogate-products/:key/template')
  @Roles('super_admin')
  @ApiOperation({
    summary: 'Save the friendly form, and the calculation it compiles to',
    description:
      'The form and the compiled rule are written in one statement, so they cannot drift. ' +
      'Refused when recompiling would orphan figures a bank has already typed — the ' +
      'refusal names those programs.',
  })
  @ApiResponse({ status: 404, description: 'SURROGATE_PRODUCT_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'PRODUCT_TEMPLATE_ORPHANS_FIGURES' })
  @ApiResponse({
    status: 422,
    description:
      'PRODUCT_TEMPLATE_INVALID — the form itself. Plus every rule code the raw path ' +
      'raises, because the compiled rule goes through the same validation.',
  })
  async setSurrogateProductTemplate(
    @Param('key') key: string,
    @Body() body: SetSurrogateProductTemplateDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return ok(await this.service.setSurrogateProductTemplate(key, body, this.actor(user, req)));
  }

  @Get('surrogate-products/:key')
  @Roles('super_admin', 'sales_manager')
  @ApiOperation({
    summary: "One surrogate product's calculation, and every bank program reachable through it",
    description:
      'The reachability walk (product → catalog names → bank programs) is what makes ' +
      '"who is affected if I change this" answerable BEFORE the operator changes it.',
  })
  @ApiResponse({ status: 404, description: 'PROGRAM_NAME_KEY_UNKNOWN' })
  async getSurrogateProduct(@Param('key') key: string) {
    return ok(await this.service.getSurrogateProduct(key));
  }

  @Put('surrogate-products/:key/income-rule')
  @Roles('super_admin')
  @ApiOperation({
    summary: "Set a surrogate product's calculation",
    description:
      'Reaches every catalog name linked to this product, and every bank program under ' +
      'those names that takes catalog amounts. A figures-only write keeps the stored ' +
      'structure, so the screen can save an edited table without re-posting a step list ' +
      'it merely rendered.',
  })
  @ApiResponse({ status: 404, description: 'PROGRAM_NAME_KEY_UNKNOWN' })
  @ApiResponse({
    status: 422,
    description:
      'PRODUCT_RULE_INVALID | INCOME_RULE_EMPTY | INCOME_RULE_INCOME_INVALID | ' +
      'INCOME_RULE_DUPLICATE_KEY | INCOME_RULE_UNKNOWN_KEY | INCOME_RULE_BANDS_INVALID | ' +
      'INCOME_RULE_DBR_OVERRIDE_INVALID | INCOME_RULE_FACT_UNAVAILABLE | ' +
      'VALUE_SOURCE_PATH_UNKNOWN | VALUE_SOURCE_VALUE_INVALID — the same rule codes a ' +
      "bank program's own save raises.",
  })
  async setSurrogateProductIncomeRule(
    @Param('key') key: string,
    @Body() body: SetProgramNameIncomeRuleDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return ok(await this.service.setSurrogateProductIncomeRule(key, body, this.actor(user, req)));
  }

  /**
   * Switch a surrogate product ON or OFF — the operator's ONE lifecycle action on a product.
   *
   * Products are not created or deleted from the admin any more: the eleven predefined ones
   * are put in by `npm run seed:blueprints`, and what an operator decides is which of them
   * this platform sells.
   *
   * OFF STOPS IT BEING USED ANYWHERE, including by catalog names already linked to it. Every
   * bank program reachable through those names comes back LISTED, carrying
   * `SURROGATE_PRODUCT_RETIRED` instead of figures — a stated reason, never a program
   * silently dropped from the shortlist (A33). It takes effect on the very next quote:
   * `programNameIncomeRules()` is uncached by contract.
   *
   * The consequence is stated on the screen BEFORE the operator confirms, against the list
   * of affected names and program codes this controller's `GET :key` already returns. There
   * is no 409 to hit — the refusal that used to block this (`SURROGATE_PRODUCT_IN_USE`) is
   * gone, because a linked name is the normal state and a product that can never be switched
   * off would be the result.
   *
   * DELEGATES to `PlatformEnumerationsAdminService.update`, so the audit event, the cache
   * invalidation and the remaining retire guards stay one implementation.
   *
   * `active` ONLY, never `deprecate`: `updateById` clears `deprecatedAt` on neither, so a
   * deprecated product could never be switched back on. Deprecation stays where it is, on
   * the generic enumerations endpoint.
   *
   * Two consequences worth knowing, both stated rather than papered over:
   *   · while a product is off, RE-SENDING `surrogateProductKey` for an already-linked name
   *     is refused (a link may only be made to a live product). The stored link is untouched
   *     and `setIncomeBases` never re-resolves it, so a linked name stays otherwise savable;
   *   · a cap-only product's QUESTION stops being read, because its fact is deactivated with
   *     it — so each bank's own cap table falls back to whatever that bank chose for an
   *     answer it has no row for (`onNoMatch`). For every other product the questions keep
   *     being asked: deactivating one republishes the questionnaire and cannot un-ask an
   *     answered question, and an unused question costs a screen where a withheld
   *     calculation costs a wrong loan amount.
   *
   * Declared with the other `surrogate-products` routes, BEFORE `@Get(':programCode')` — the
   * trap this controller documents at the top.
   */
  @Put('surrogate-products/:key/active')
  @Roles('super_admin')
  @ApiOperation({
    summary: 'Switch a surrogate product on or off',
    description:
      'OFF withholds the calculation from every catalog name linked to it, so their bank ' +
      'programs stop matching and report `SURROGATE_PRODUCT_RETIRED`. Issued offers are ' +
      'untouched — they carry their own frozen figures. Nothing is deleted.',
  })
  @ApiResponse({ status: 404, description: 'SURROGATE_PRODUCT_NOT_FOUND' })
  async setSurrogateProductActive(
    @Param('key') key: string,
    @Body() body: SetSurrogateProductActiveDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return ok(
      await this.service.setSurrogateProductActive(key, body.active, this.actor(user, req)),
    );
  }

  /**
   * WHAT THIS PRODUCT ASKS THE APPLICANT — the board step ① renders, in one response.
   *
   * The product's ask set, the WHOLE active question pool, and per ask both who else reads
   * it and whether it can be removed here. One read rather than three, and not because it
   * is fewer round trips: the three existing reads cannot be composed. The question pool
   * sits on a controller scoped to `super_admin` alone, the fact registry reaches the admin
   * through a per-session client cache that a tick cannot invalidate, and "which other
   * products read this fact" is answerable only from the ask table. Three answers that can
   * disagree about the state one click produced is exactly what this avoids.
   *
   * Declared with the rest of the `surrogate-products` block and before `:programCode`.
   */
  @Get('surrogate-products/:key/asks')
  @Roles('super_admin', 'sales_manager')
  @ApiOperation({
    summary: 'What a surrogate product asks, and every pool question it could ask',
  })
  @ApiResponse({ status: 404, description: 'SURROGATE_PRODUCT_NOT_FOUND' })
  async getProductAsks(@Param('key') key: string) {
    return ok(await this.asks.board(key));
  }

  /**
   * Tick a pool question: this product starts reading its answer.
   *
   * ADDRESSED BY THE QUESTION, because that is what the operator picked and the fact may
   * not exist yet — the detach below is addressed by the FACT, because that is what exists
   * and what the screen already renders. One address for both would force one of them to
   * name something that is not there.
   *
   * ONE COMPOSITE CALL. The server creates or joins the fact, binds it, records the ask,
   * adds the loan types the tick asks for, and publishes the questionnaire once — and only
   * if a loan type actually moved. `askIn` is ADDITIVE and never narrows: the assignment is
   * global to the question and shared with every other product that reads it.
   *
   * REUSE FIRST. A question already answered by a fact joins THAT fact rather than minting
   * a second key over one answer, which is what makes ticking a platform fact or one a
   * blueprint already asks for a safe, non-destructive act.
   */
  @Put('surrogate-products/:key/asks/:questionCode')
  @Roles('super_admin')
  @ApiOperation({ summary: "Make a surrogate product read a pool question's answer" })
  @ApiResponse({ status: 404, description: 'SURROGATE_PRODUCT_NOT_FOUND' })
  @ApiResponse({
    status: 409,
    description: 'SURROGATE_FACT_AMBIGUOUS_FOR_QUESTION | SURROGATE_FACT_KEY_TAKEN',
  })
  @ApiResponse({
    status: 422,
    description:
      'SURROGATE_FACT_QUESTION_INACTIVE | SURROGATE_FACT_QUESTION_TYPE_INVALID | ' +
      'SURROGATE_FACT_WIDEN_REQUIRED | ' +
      'SURROGATE_FACT_KEY_RESERVED',
  })
  async attachProductAsk(
    @Param('key') key: string,
    @Param('questionCode') questionCode: string,
    @Body() body: AttachProductAskDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return ok(await this.asks.attach(key, questionCode, body, this.actor(user, req)));
  }

  /**
   * Untick: this product stops reading the answer.
   *
   * DETACHES ONLY. The question stays in the pool and the loan types that ask it are
   * untouched — narrowing that set belongs on `/questionnaire/categories`, where it is the
   * whole point of the surface, and doing it from here would silently stop asking a question
   * some other product reads. Nothing is published.
   *
   * The FACT ROW goes too only when nothing is left of it: no other product asks it, nothing
   * anywhere reads it, this product authored it, and it is not one of the platform's own.
   * Otherwise the row survives and only this product's ask goes.
   *
   * Idempotent: unticking an ask that is not there returns the unchanged board, because a
   * double-click must not be a 404.
   */
  @Delete('surrogate-products/:key/asks/:factKey')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Stop a surrogate product reading a fact' })
  @ApiResponse({ status: 404, description: 'SURROGATE_PRODUCT_NOT_FOUND' })
  @ApiResponse({
    status: 409,
    description: 'PRODUCT_ASK_READ_BY_OWN_RULE | ENUMERATION_IN_USE',
  })
  @ApiResponse({ status: 422, description: 'PRODUCT_ASK_BLUEPRINT_OWNED' })
  async detachProductAsk(
    @Param('key') key: string,
    @Param('factKey') factKey: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return ok(await this.asks.detach(key, factKey, this.actor(user, req)));
  }

  @Get(':programCode')
  @ApiOperation({ summary: "Fetch a single bank program's full configuration" })
  @ApiResponse({ status: 200, description: 'Bank program detail.' })
  @ApiResponse({ status: 404, description: 'BANK_PROGRAM_NOT_FOUND' })
  async findOne(@Param('programCode') programCode: string) {
    const program = await this.service.findOne(programCode);
    return ok(program);
  }

  @Post()
  @Roles('super_admin', 'sales_manager')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new bank program (admin or super_admin)' })
  @ApiResponse({ status: 201, description: 'Program created.' })
  @ApiResponse({ status: 409, description: 'PROGRAM_CODE_ALREADY_IN_USE' })
  @ApiResponse({
    status: 422,
    description:
      'INVALID_VARIABLE_RATE_CONFIGURATION | INVALID_QUALITATIVE_REVIEW_CEILING | QUALITATIVE_REVIEW_CEILING_BELOW_BASE | DERIVATION_ARITHMETIC_MISMATCH | UNKNOWN_ENUMERATION_KEY | DEPRECATED_ENUMERATION_KEY | VALIDATION_FAILED',
  })
  @ApiResponse({ status: 503, description: 'ENUMERATION_REGISTRY_UNAVAILABLE' })
  async create(
    @Body() body: CreateBankProgramDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const program = await this.service.create(body, this.actor(user, req));
    return ok(program);
  }

  @Post(':programCode')
  @Roles('super_admin', 'sales_manager')
  async update(
    @Param('programCode') programCode: string,
    @Body() body: UpdateBankProgramDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const program = await this.service.update(programCode, body, this.actor(user, req));
    return ok(program);
  }

  /**
   * The catalog program name's income rule.
   *
   * On THIS controller, not on `admin/enumerations`, even though the row it writes is
   * an enumeration: every piece of machinery that decides whether a rule is acceptable
   * — `IncomeAssumptionConfigDto`, `validateIncomeRule`, the registry context it needs,
   * the typed 422s — lives in this module, and moving the check the other way would
   * make bank-programs and platform-enumerations circular. The audit event is still
   * `PLATFORM_ENUMERATION_UPDATED`, so the change reads where an operator looks for it.
   *
   * Addressed by the catalog KEY rather than the enumeration id: it is what a bank
   * program stores, what the catalog URL carries, and what an operator recognises.
   */
  @Get('program-names/:programNameKey/income-rule')
  @Roles('super_admin', 'sales_manager')
  @ApiOperation({ summary: "A catalog program name's income proof, figures, and who reads them" })
  @ApiResponse({ status: 404, description: 'PROGRAM_NAME_KEY_UNKNOWN' })
  async getProgramNameIncomeRule(@Param('programNameKey') programNameKey: string) {
    return ok(await this.service.getProgramNameIncomeRule(programNameKey));
  }

  @Put('program-names/:programNameKey/income-rule')
  @Roles('super_admin')
  @ApiOperation({
    summary:
      'Set what a catalog program name reads its income from, and the figures banks start from',
    description:
      'One name states ONE income proof; every surrogate program filed under it reads that one, ' +
      'and a bank may change only the AMOUNTS. `incomeRule: null` says the name states nothing ' +
      'again, which blocks the next surrogate program from being filed under it until someone ' +
      'decides. Both the proof change and the clear are refused while surrogate programs are ' +
      'still reading it — their tables are keyed by the old proof.',
  })
  @ApiResponse({ status: 404, description: 'PROGRAM_NAME_KEY_UNKNOWN' })
  @ApiResponse({
    status: 422,
    description:
      'PROGRAM_NAME_RULE_LINKED (the name takes its calculation from a surrogate product ' +
      '— edit the product instead) | ' +
      'INCOME_PROOF_IN_USE | INCOME_RULE_EMPTY | INCOME_RULE_INCOME_INVALID | ' +
      'INCOME_RULE_DUPLICATE_KEY | INCOME_RULE_UNKNOWN_KEY | INCOME_RULE_BANDS_INVALID | ' +
      'INCOME_RULE_DBR_OVERRIDE_INVALID | INCOME_RULE_FACT_UNAVAILABLE | ' +
      'VALUE_SOURCE_PATH_UNKNOWN | VALUE_SOURCE_VALUE_INVALID — the same rule codes a bank ' +
      "program's own save raises, so the catalog can never accept a table a program is then " +
      'refused for.',
  })
  async setProgramNameIncomeRule(
    @Param('programNameKey') programNameKey: string,
    @Body() body: SetProgramNameIncomeRuleDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return ok(
      await this.service.setProgramNameIncomeRule(programNameKey, body, this.actor(user, req)),
    );
  }

  @Post('income-rule/check')
  @Roles('super_admin', 'sales_manager')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Run a sample applicant against an UNSAVED program\u2019s income rule',
    description:
      'The CREATE wizard\u2019s panel. Identical to the sibling route below in every respect ' +
      'except where the program comes from: there is no saved row yet, so the draft carries the ' +
      'tenor, limits, pricing, eligibility and fees a quote reads. Same snapshot mapper, same ' +
      'validator, same quoteProgram — a draft check and a saved check cannot disagree, because ' +
      'they are one code path after the snapshot. Persists nothing (FR-029).',
  })
  @ApiResponse({ status: 200, description: 'Check result — figures, or a stated reason.' })
  @ApiResponse({
    status: 422,
    description: 'The same rule codes the save path raises, plus VALIDATION_FAILED.',
  })
  async checkIncomeRuleDraft(@Body() body: IncomeRuleDraftCheckDto) {
    return ok(await this.service.checkIncomeRuleDraft(body));
  }

  @Post(':programCode/income-rule/check')
  @Roles('super_admin', 'sales_manager')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Run a sample applicant against the ON-SCREEN income rule (persists nothing)',
    description:
      'Feature 011 / FR-026 – FR-031. The draft rule travels in the BODY so unsaved edits are ' +
      'what gets evaluated (FR-028). Nothing is written: no application, no lead, no offer ' +
      '(FR-029). Overlays the draft on the saved program snapshot and calls the SAME ' +
      'quoteProgram the matching simulator calls, which is what makes agreement with the ' +
      'simulator structural rather than asserted (FR-030 / SC-007). A resolved income of null ' +
      'is a STATED reason, never a zero (FR-031). `qualifies` is derived from the quote figures ' +
      'alone — no eligibility rule is consulted (FR-027, A33).',
  })
  @ApiResponse({ status: 200, description: 'Check result — figures, or a stated reason.' })
  @ApiResponse({ status: 404, description: 'BANK_PROGRAM_NOT_FOUND' })
  @ApiResponse({
    status: 422,
    description:
      'INCOME_RULE_EMPTY | INCOME_RULE_INCOME_INVALID | INCOME_RULE_DUPLICATE_KEY | ' +
      'INCOME_RULE_UNKNOWN_KEY | INCOME_RULE_BANDS_INVALID | INCOME_RULE_DBR_OVERRIDE_INVALID | ' +
      'VALIDATION_FAILED — the same codes the save path raises, so an unsaveable rule cannot ' +
      'appear to work here.',
  })
  async checkIncomeRule(
    @Param('programCode') programCode: string,
    @Body() body: IncomeRuleCheckDto,
  ) {
    const result = await this.service.checkIncomeRule(programCode, body);
    return ok(result);
  }

  @Post(':programCode/duplicate')
  @Roles('super_admin')
  @HttpCode(201)
  @ApiOperation({ summary: 'Duplicate a program into a new inactive draft (FR-013)' })
  @ApiResponse({ status: 201, description: 'Draft copy created.' })
  @ApiResponse({ status: 404, description: 'BANK_PROGRAM_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'PROGRAM_CODE_ALREADY_IN_USE' })
  async duplicate(
    @Param('programCode') programCode: string,
    @Body() body: DuplicateBankProgramDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const program = await this.service.duplicate(programCode, body, this.actor(user, req));
    return ok(program);
  }

  @Post(':programCode/toggle')
  @Roles('super_admin', 'sales_manager')
  @ApiOperation({ summary: 'Toggle a program active/inactive' })
  @ApiResponse({ status: 200, description: 'Toggled.' })
  @ApiResponse({ status: 409, description: 'CONFLICT_STALE_DATA' })
  async toggle(
    @Param('programCode') programCode: string,
    @Body() body: ToggleBankProgramDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const program = await this.service.toggle(
      programCode,
      body.active,
      body.version,
      this.actor(user, req),
    );
    return ok(program);
  }

  @Delete(':programCode')
  @Roles('super_admin')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a bank program (super_admin only)' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 409, description: 'BANK_PROGRAM_HAS_OFFERS' })
  async delete(
    @Param('programCode') programCode: string,
    @Headers('x-confirm-program-code') confirmHeader: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<void> {
    if (!confirmHeader || confirmHeader !== programCode) {
      throw new BankProgramNotFoundException({ programCode });
    }
    await this.service.deleteByCode(programCode, this.actor(user, req));
  }

  private actor(user: JwtPayload, req: Request): ActorCtx {
    return {
      id: user.sub,
      sourceIp: this.readClientIp(req),
    };
  }

  private readClientIp(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim() ?? null;
    }
    return req.ip ?? null;
  }
}
