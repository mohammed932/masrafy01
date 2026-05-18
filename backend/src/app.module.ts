import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { CorrelationIdMiddleware } from '@/common/middleware/correlation-id.middleware';
import { HttpExceptionFilter } from '@/common/errors/http-exception.filter';
import { InfraModule } from '@/infra/infra.module';
import { AuditModule } from '@/audit/audit.module';
import { HealthModule } from '@/health/health.module';
import { AuthModule } from '@/auth/auth.module';
import { UsersModule } from '@/users/users.module';
import { BanksModule } from '@/banks/banks.module';
import { BankProgramsModule } from '@/bank-programs/bank-programs.module';
import { ApplicationsModule } from '@/applications/applications.module';
import { ScoringVersionsModule } from '@/scoring-versions/scoring-versions.module';
import { ScoringAnalyticsModule } from '@/scoring-analytics/scoring-analytics.module';
import { PlatformEnumerationsModule } from '@/platform-enumerations/platform-enumerations.module';
import { ActivitiesModule } from '@/activities/activities.module';
import { DocumentsModule } from '@/documents/documents.module';
import { LeadAnalyticsModule } from '@/lead-analytics/lead-analytics.module';
import { loadEnv } from '@/infra/env/env.schema';
import { pinoOptions } from '@/common/pino/pino.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (raw) => loadEnv(raw as NodeJS.ProcessEnv),
    }),
    ScheduleModule.forRoot(),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) =>
        pinoOptions(
          cfg.getOrThrow<string>('LOG_LEVEL'),
          cfg.getOrThrow<string>('NODE_ENV') === 'production',
        ),
    }),
    InfraModule,
    AuditModule,
    HealthModule,
    AuthModule,
    UsersModule,
    PlatformEnumerationsModule,
    BanksModule,
    BankProgramsModule,
    ScoringVersionsModule,
    ScoringAnalyticsModule,
    ApplicationsModule,
    ActivitiesModule,
    DocumentsModule,
    LeadAnalyticsModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
