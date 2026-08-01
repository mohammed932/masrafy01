import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { ok } from '@/common/pagination/paginated.response.dto';
import { QuestionnaireService } from './questionnaire.service';
import {
  CreateGroupDto,
  CreateOptionDto,
  CreateQuestionDto,
  UpdateGroupDto,
  UpdateOptionDto,
  UpdateQuestionDto,
} from './dto/questionnaire.dto';

/**
 * Admin questionnaire CRUD + versioning (Constitution V v4.1.0 — questionnaire
 * is admin-editable data). super_admin + sales_manager may edit; publish is the
 * snapshot step that the mobile app reads.
 */
@ApiTags('Admin · Questionnaire')
@ApiBearerAuth()
@Controller('admin/questionnaire')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'sales_manager')
// Admin authoring/read endpoints are JWT + role gated — the global 100/15-min
// throttle only adds dev friction when the editor fans out tree+history reads
// across reloads. Abuse vector is covered by auth, so skip throttling here
// (same posture as the platform-enumerations admin controller).
@SkipThrottle()
export class AdminQuestionnaireController {
  constructor(private readonly service: QuestionnaireService) {}

  @Get('tree')
  @ApiOperation({ summary: 'Editable working tree of the global pool (groups → questions → options)' })
  async tree() {
    return ok(await this.service.draftTree());
  }

  @Post('groups')
  @ApiOperation({ summary: 'Create a question group' })
  async createGroup(@Body() dto: CreateGroupDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.service.createGroup(dto, user.sub));
  }

  @Patch('groups/:id')
  @ApiOperation({ summary: 'Edit / soft-hide a group' })
  async updateGroup(
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return ok(await this.service.updateGroup(id, dto, user.sub));
  }

  @Delete('groups/:id')
  @ApiOperation({ summary: 'Soft-delete a group (blocked while it has active questions)' })
  async deleteGroup(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return ok(await this.service.softDeleteGroup(id, user.sub));
  }

  @Post('questions')
  @ApiOperation({ summary: 'Create a question (code auto-generated)' })
  async createQuestion(@Body() dto: CreateQuestionDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.service.createQuestion(dto, user.sub));
  }

  @Patch('questions/:id')
  @ApiOperation({ summary: 'Edit a question (code immutable)' })
  async updateQuestion(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return ok(await this.service.updateQuestion(id, dto, user.sub));
  }

  @Delete('questions/:id')
  @ApiOperation({ summary: 'Soft-delete a question (blocked if a branch depends on it)' })
  async deleteQuestion(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return ok(await this.service.softDeleteQuestion(id, user.sub));
  }

  @Get('questions/:id/options')
  @ApiOperation({ summary: 'List a question’s options' })
  async listOptions(@Param('id') id: string) {
    return ok(await this.service.listOptions(id));
  }

  @Post('questions/:id/options')
  @ApiOperation({ summary: 'Add an option (code auto-generated)' })
  async createOption(
    @Param('id') id: string,
    @Body() dto: CreateOptionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return ok(await this.service.createOption(id, dto, user.sub));
  }

  @Patch('options/:optionId')
  @ApiOperation({ summary: 'Edit an option' })
  async updateOption(
    @Param('optionId') optionId: string,
    @Body() dto: UpdateOptionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return ok(await this.service.updateOption(optionId, dto, user.sub));
  }

  @Delete('options/:optionId')
  @ApiOperation({ summary: 'Soft-delete an option (blocked while a branch references it)' })
  async deleteOption(@Param('optionId') optionId: string, @CurrentUser() user: JwtPayload) {
    return ok(await this.service.softDeleteOption(optionId, user.sub));
  }

  @Post('versions/publish')
  @ApiOperation({
    summary: 'Snapshot the active draft → new active version (global)',
    description:
      'Succeeds even when it returns warnings[]: a missing money-field binding is reported, not fatal (FR-049).',
  })
  async publish(@CurrentUser() user: JwtPayload) {
    return ok(await this.service.publish(user.sub));
  }

  @Get('binding-warnings')
  @ApiOperation({
    summary: 'Money-field binding warnings for the current pool',
    description:
      'Which of the four code-declared money bindings resolve to no active NUMERIC question. Read-only: publishes nothing. Feature 010, FR-048/FR-049.',
  })
  async bindingWarnings() {
    return ok(await this.service.bindingWarnings());
  }

  @Get('versions/history')
  @ApiOperation({ summary: 'List published questionnaire versions (global)' })
  async history() {
    return ok(await this.service.history());
  }

  @Post('versions/rollback/:versionId')
  @ApiOperation({ summary: 'Re-activate an older published version' })
  async rollback(@Param('versionId') versionId: string) {
    return ok(await this.service.rollback(versionId));
  }
}
