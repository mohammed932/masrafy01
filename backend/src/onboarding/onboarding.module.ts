import { Module } from '@nestjs/common';
import { AuditModule } from '@/audit/audit.module';
import { AuthModule } from '@/auth/auth.module';
import { CustomerAuthModule } from '@/customer-auth/customer-auth.module';
import { InfraModule } from '@/infra/infra.module';
import { AdminOnboardingController } from './admin-onboarding.controller';
import { MobileOnboardingController } from './mobile-onboarding.controller';
import { OnboardingRepository } from './onboarding.repository';
import { OnboardingService } from './onboarding.service';

/**
 * Mobile first-launch onboarding screens (Constitution v3.0.0 / Principle XIII —
 * JWT-only).
 * - Mobile: customer-JWT GET (Cache-Control 5min).
 * - Admin: super_admin CRUD + reorder.
 */
@Module({
  imports: [AuditModule, AuthModule, CustomerAuthModule, InfraModule],
  controllers: [MobileOnboardingController, AdminOnboardingController],
  providers: [OnboardingRepository, OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
