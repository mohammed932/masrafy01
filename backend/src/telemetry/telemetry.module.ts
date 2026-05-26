import { Module } from '@nestjs/common';
import { AuditModule } from '@/audit/audit.module';
import { CustomerAuthModule } from '@/customer-auth/customer-auth.module';
import { InfraModule } from '@/infra/infra.module';
import { MobileHmacGuard } from '@/applications/guards/mobile-hmac.guard';
import { MobileTelemetryController } from './mobile-telemetry.controller';

@Module({
  imports: [AuditModule, CustomerAuthModule, InfraModule],
  controllers: [MobileTelemetryController],
  providers: [MobileHmacGuard],
})
export class TelemetryModule {}
