import { Module } from '@nestjs/common';
import { AuditModule } from '@/audit/audit.module';
import { AuthModule } from '@/auth/auth.module';
import { CustomerAuthModule } from '@/customer-auth/customer-auth.module';
import { InfraModule } from '@/infra/infra.module';
import { MobileHmacGuard } from '@/applications/guards/mobile-hmac.guard';
import { MobileSupportController } from './mobile-support.controller';
import { AdminSupportController } from './admin-support.controller';
import { SupportRepository } from './support.repository';
import { SupportService } from './support.service';

/**
 * Mobile "Need Help" surface + admin support inbox (PR #5 / v1.7.0).
 * - Mobile: HMAC + optional customer JWT.
 * - Admin: staff JWT + role-gated.
 */
@Module({
  imports: [AuditModule, AuthModule, CustomerAuthModule, InfraModule],
  controllers: [MobileSupportController, AdminSupportController],
  providers: [SupportRepository, SupportService, MobileHmacGuard],
  exports: [SupportService],
})
export class SupportModule {}
