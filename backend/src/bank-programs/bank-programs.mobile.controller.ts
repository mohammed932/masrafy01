import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '../common/pagination/paginated.response.dto';
import { BankProgramsMobileService } from './bank-programs.mobile.service';

/**
 * Mobile read-only catalog endpoints. Future HMAC middleware (Principle XIII) wraps
 * this controller. For Phase 7 MVP the controller is mounted under /api/mobile/v1
 * without HMAC enforcement — middleware lands when the Flutter client ships.
 */
@ApiTags('bank-programs-mobile')
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
