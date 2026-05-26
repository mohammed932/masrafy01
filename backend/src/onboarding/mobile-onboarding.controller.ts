import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MobileHmacGuard } from '@/applications/guards/mobile-hmac.guard';
import { ok } from '@/common/pagination/paginated.response.dto';
import { OnboardingService } from './onboarding.service';
import { OnboardingScreenResponseDto } from './dto/onboarding.dto';

@ApiTags('Mobile · Onboarding')
@Controller('v1/onboarding')
@UseGuards(MobileHmacGuard)
export class MobileOnboardingController {
  constructor(private readonly svc: OnboardingService) {}

  @Get('screens')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Active onboarding screens, ordered (first-launch wizard)' })
  async list(): Promise<{ success: true; data: OnboardingScreenResponseDto[] }> {
    const data = await this.svc.listMobile();
    return ok(data);
  }
}
