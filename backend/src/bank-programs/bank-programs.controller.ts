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
import {
  IncomeRuleCheckDto,
  IncomeRuleDraftCheckDto,
} from './dto/income-rule-check.dto';
import { SetProgramNameIncomeRuleDto } from './dto/program-name-income-rule.dto';
import { BankProgramsService } from './bank-programs.service';
import { BankProgramNotFoundException } from '../common/errors/domain.exceptions';

interface ActorCtx {
  id: string;
  sourceIp: string | null;
}

@ApiTags('bank-programs-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/bank-programs')
export class BankProgramsController {
  constructor(private readonly service: BankProgramsService) {}

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
    const program = await this.service.update(
      programCode,
      body,
      this.actor(user, req),
    );
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
    summary: 'Set what a catalog program name reads its income from, and the figures banks start from',
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
