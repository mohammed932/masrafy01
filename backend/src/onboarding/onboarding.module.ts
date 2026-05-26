import { Module } from '@nestjs/common';
import { AuditModule } from '@/audit/audit.module';
import { AuthModule } from '@/auth/auth.module';
import { InfraModule } from '@/infra/infra.module';
import { MobileHmacGuard } from '@/applications/guards/mobile-hmac.guard';
import { AdminOnboardingController } from './admin-onboarding.controller';
import { MobileOnboardingController } from './mobile-onboarding.controller';
import { OnboardingRepository } from './onboarding.repository';
import { OnboardingService } from './onboarding.service';

/**
 * Mobile first-launch onboarding screens (PR #6 / v1.7.0).
 * - Mobile: HMAC-only GET (Cache-Control 5min).
 * - Admin: super_admin CRUD + reorder.
 */
@Module({
  imports: [AuditModule, AuthModule, InfraModule],
  controllers: [MobileOnboardingController, AdminOnboardingController],
  providers: [OnboardingRepository, OnboardingService, MobileHmacGuard],
  exports: [OnboardingService],
})
export class OnboardingModule {}
