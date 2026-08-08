import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { LoanCategory } from '@prisma/client';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { sortCategories } from '@/common/loan-category.util';
import { PlatformEnumerationsAdminService } from './platform-enumerations-admin.service';
import {
  CatalogQuestionDto,
  CreateEnumerationDto,
  EnumerationRowDto,
  SetEnumerationCategoriesBulkDto,
  SetEnumerationCategoriesDto,
  SetEnumerationQuestionsDto,
  UpdateEnumerationDto,
} from './dto/enumeration.dto';

const PROGRAM_NAME_TYPE = 'program_name';

@ApiTags('Admin · Platform enumerations')
@ApiBearerAuth()
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
   * The active question pool the catalog's template board picks from.
   *
   * Static segment, declared with the other statics so no future `:id` route at
   * this depth can shadow it.
   *
   * Not served by reusing `GET /admin/scoring/questions`: that endpoint sits on a
   * controller scoped `super_admin` + `sales_manager` (this one is super-admin
   * only) and carries options, numeric bounds, units and text length that this
   * board never renders.
   */
  @Get('questions')
  @ApiOperation({ summary: 'Active questions a catalog name may be templated with' })
  async questionPool(): Promise<{ success: true; data: CatalogQuestionDto[] }> {
    const data = await this.service.questionPool();
    return { success: true, data };
  }

  @Get()
  @ApiOperation({ summary: 'List enumeration members (optionally filtered by type)' })
  async list(@Query('type') type?: string): Promise<{ success: true; data: EnumerationRowDto[] }> {
    const rows = await this.service.listAll({ type });
    // Usage, loan-category assignment and the question template are all
    // meaningful only for the program catalog, and three extra queries for the
    // whole page beat three per row.
    const isCatalog = type === PROGRAM_NAME_TYPE || rows.some((r) => r.type === PROGRAM_NAME_TYPE);
    const projectCatalog = isCatalog ? await this.catalogProjector() : null;
    return {
      success: true,
      data: rows.map((r) =>
        r.type === PROGRAM_NAME_TYPE && projectCatalog ? projectCatalog(r) : this.project(r),
      ),
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
   * Replace one catalog name's SUGGESTED question set FOR ONE loan category
   * (`body.category`). Advisory: it pre-ticks the per-program scoring wizard and
   * constrains nothing — `saveWeights` never reads it, so this can never
   * invalidate a weight set a bank already saved.
   *
   * The category rides in the BODY, not the path. It is not a sub-resource being
   * addressed — it is which of the entry's four sets this array replaces, and a
   * `:category` segment would invite a GET on the same path that nothing serves
   * (the whole template comes back on every row).
   *
   * No bulk sibling, unlike `POST categories`. That one exists because a column
   * action there spans 16 ROWS; here every action — one tap, tick-all, clear-all
   * — produces a new set for ONE name under ONE category, so it is one PUT with
   * the whole array.
   */
  @Put(':id/questions')
  @ApiOperation({ summary: 'Replace one catalog name’s suggested question set for one category' })
  async setQuestions(
    @Param('id') id: string,
    @Body() body: SetEnumerationQuestionsDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ): Promise<{ success: true; data: EnumerationRowDto }> {
    const row = await this.service.setQuestions(id, body.category, body.questionCodes, {
      staffId: user.sub,
      sourceIp: ip ?? null,
    });
    const projectCatalog = await this.catalogProjector();
    return { success: true, data: projectCatalog(row) };
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
    const [usage, categories, questions] = await Promise.all([
      this.service.programNameUsage(),
      this.service.categoryAssignments({ type: PROGRAM_NAME_TYPE }),
      this.service.questionAssignments({ type: PROGRAM_NAME_TYPE }),
    ]);
    return (row) =>
      this.project(row, {
        usage: usage.get(row.key) ?? { programs: 0, banks: 0 },
        categories: [...sortCategories(categories.get(row.id) ?? [])],
        questionsByCategory: questions.get(row.id) ?? {},
      });
  }

  private project(
    row: {
      id: string;
      type: string;
      key: string;
      labelAr: string;
      labelEn: string;
      active: boolean;
      deprecatedAt: Date | null;
      systemOnly: boolean;
      parentKey: string | null;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
    },
    // One `extras` bag rather than a fourth positional — the catalog now
    // attaches three optional things and the next one would be unreadable.
    extras: {
      usage?: { programs: number; banks: number };
      categories?: LoanCategory[];
      questionsByCategory?: Partial<Record<LoanCategory, string[]>>;
    } = {},
  ): EnumerationRowDto {
    const { usage, categories, questionsByCategory } = extras;
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
      ...(usage ? { usage } : {}),
      // Spread conditionally, like `usage`: absent means "this type has no such
      // axis", while a present `[]` means parked. Collapsing the two would make
      // every currency row read as deliberately offerable nowhere.
      ...(categories ? { categories } : {}),
      // Same rule: absent = no template axis; present `{}` = nothing suggested
      // for any category yet, which is the day-one state.
      ...(questionsByCategory ? { questionsByCategory } : {}),
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
