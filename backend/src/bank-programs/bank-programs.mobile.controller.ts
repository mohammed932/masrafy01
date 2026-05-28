import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomerJwtGuard } from '@/customer-auth/guards/customer-jwt.guard';
import { ok } from '../common/pagination/paginated.response.dto';
import { BankProgramsMobileService } from './bank-programs.mobile.service';

/**
 * Mobile read-only catalog endpoints. Constitution v3.0.0 / Principle XIII —
 * every reachable in-app feature requires a valid customer Bearer JWT.
 */
@ApiTags('bank-programs-mobile')
@ApiBearerAuth('CustomerBearerAuth')
@UseGuards(CustomerJwtGuard)
@Controller('mobile/v1/bank-programs')
export class BankProgramsMobileController {
  constructor(private readonly service: BankProgramsMobileService) {}

  @Get()
  @ApiOperation({ summary: 'List active bank programs (mobile read-only)' })
  async list() {
    const rows = await this.service.listActive();
    return ok(rows);
  }

  @Get(':programCode')
  @ApiOperation({
    summary: 'Get an active bank program by code (mobile read-only)',
    description: 'Returns 404 for inactive or missing programs — no metadata leakage (FR-030).',
  })
  async getOne(@Param('programCode') programCode: string) {
    const program = await this.service.getActiveByCode(programCode);
    return ok(program);
  }
}
