/**
 * Scoring engine version registry — feature 004.
 * Exports `ScoringEngineVersionService` so the applications-orchestrator adapter can
 * hydrate an active `ScoringConfig` value object before invoking the matching engine.
 */
import { Module } from '@nestjs/common';
import { AuditModule } from '@/audit/audit.module';
import { ScoringEngineVersionRepository } from './scoring-versions.repository';
import { ScoringEngineVersionService } from './scoring-versions.service';
import { ScoringVersionsController } from './scoring-versions.controller';

@Module({
  imports: [AuditModule],
  controllers: [ScoringVersionsController],
  providers: [ScoringEngineVersionRepository, ScoringEngineVersionService],
  exports: [ScoringEngineVersionService],
})
export class ScoringVersionsModule {}
