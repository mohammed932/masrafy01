import { Module } from '@nestjs/common';
import { ActivitiesModule } from '@/activities/activities.module';
import { AuthModule } from '@/auth/auth.module';
import { LeadAnalyticsController } from './lead-analytics.controller';
import { LeadAnalyticsRepository } from './lead-analytics.repository';
import { LeadAnalyticsService } from './lead-analytics.service';
import { AliasResolverService } from './alias-resolver.service';

@Module({
  imports: [AuthModule, ActivitiesModule],
  controllers: [LeadAnalyticsController],
  providers: [LeadAnalyticsRepository, LeadAnalyticsService, AliasResolverService],
  exports: [AliasResolverService],
})
export class LeadAnalyticsModule {}
