import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ok } from '@/common/pagination/paginated.response.dto';
import { MatchingPreviewService, SIMULATOR_DEFAULT_AGE } from './matching-preview.service';
import { SimulateMatchesDto } from './dto/simulate-matches.dto';

/**
 * Admin matching simulator. Runs the SAME per-bank weighted approval scoring as
 * the customer preview (`MatchingPreviewService`), but admin-JWT-gated — lets ops
 * test "how would programs rank for applicant X" (approval %) without creating a
 * real application. Read-only: persists nothing.
 */
@ApiTags('Admin · Matching simulator')
@ApiBearerAuth()
@Controller('admin/matching')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'sales_manager', 'analyst')
export class AdminMatchingController {
  constructor(private readonly service: MatchingPreviewService) {}

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run full matching + approval scoring for a sample applicant (no persistence)' })
  async simulate(@Body() dto: SimulateMatchesDto): Promise<{ success: true; data: unknown }> {
    const result = await this.service.preview({
      category: dto.category,
      answers: dto.answers,
      // No customer here — the admin's sample applicant carries its own age.
      age: dto.age ?? SIMULATOR_DEFAULT_AGE,
      // Inherited from `PreviewMatchesDto`, and optional here on purpose: the
      // admin simulating a category wants the whole category by default, and
      // sets a name (or an income basis) only when reproducing what one
      // applicant saw.
      programNameKey: dto.programNameKey,
      programType: dto.programType,
    });
    return ok(result);
  }
}
