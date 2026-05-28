import { Module } from '@nestjs/common';
import { AuditModule } from '@/audit/audit.module';
import { CustomerAuthModule } from '@/customer-auth/customer-auth.module';
import { InfraModule } from '@/infra/infra.module';
import { MobileTelemetryController } from './mobile-telemetry.controller';

@Module({
  imports: [AuditModule, CustomerAuthModule, InfraModule],
  controllers: [MobileTelemetryController],
})
export class TelemetryModule {}
