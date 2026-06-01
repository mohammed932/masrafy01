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
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { ok } from '@/common/pagination/paginated.response.dto';
import { QuestionnaireService } from './questionnaire.service';
import { parseCategory } from './category.util';
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
export class AdminQuestionnaireController {
  constructor(private readonly service: QuestionnaireService) {}

  @Get('tree/:category')
  @ApiOperation({ summary: 'Editable working tree (groups → questions → options)' })
  async tree(@Param('category') category: string) {
    return ok(await this.service.draftTree(parseCategory(category)));
  }

  @Post('groups')
  @ApiOperation({ summary: 'Create a question group' })
  async createGroup(@Body() dto: CreateGroupDto) {
    return ok(await this.service.createGroup(dto));
  }

  @Patch('groups/:id')
  @ApiOperation({ summary: 'Edit / soft-hide a group' })
  async updateGroup(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return ok(await this.service.updateGroup(id, dto));
  }

  @Post('questions')
  @ApiOperation({ summary: 'Create a question (code auto-generated)' })
  async createQuestion(@Body() dto: CreateQuestionDto) {
    return ok(await this.service.createQuestion(dto));
  }

  @Patch('questions/:id')
  @ApiOperation({ summary: 'Edit a question (code/category/systemRole immutable)' })
  async updateQuestion(@Param('id') id: string, @Body() dto: UpdateQuestionDto) {
    return ok(await this.service.updateQuestion(id, dto));
  }

  @Delete('questions/:id')
  @ApiOperation({ summary: 'Soft-delete a question (blocked if a branch depends on it)' })
  async deleteQuestion(@Param('id') id: string) {
    return ok(await this.service.softDeleteQuestion(id));
  }

  @Get('questions/:id/options')
  @ApiOperation({ summary: 'List a question’s options' })
  async listOptions(@Param('id') id: string) {
    return ok(await this.service.listOptions(id));
  }

  @Post('questions/:id/options')
  @ApiOperation({ summary: 'Add an option (code auto-generated)' })
  async createOption(@Param('id') id: string, @Body() dto: CreateOptionDto) {
    return ok(await this.service.createOption(id, dto));
  }

  @Patch('options/:optionId')
  @ApiOperation({ summary: 'Edit an option' })
  async updateOption(@Param('optionId') optionId: string, @Body() dto: UpdateOptionDto) {
    return ok(await this.service.updateOption(optionId, dto));
  }

  @Post('versions/:category/publish')
  @ApiOperation({ summary: 'Snapshot the active draft → new active version' })
  async publish(@Param('category') category: string, @CurrentUser() user: JwtPayload) {
    return ok(await this.service.publish(parseCategory(category), user.sub));
  }

  @Get('versions/:category/history')
  @ApiOperation({ summary: 'List published versions for a category' })
  async history(@Param('category') category: string) {
    return ok(await this.service.history(parseCategory(category)));
  }

  @Post('versions/:category/rollback/:versionId')
  @ApiOperation({ summary: 'Re-activate an older published version' })
  async rollback(@Param('category') category: string, @Param('versionId') versionId: string) {
    return ok(await this.service.rollback(parseCategory(category), versionId));
  }
}
