/**
 * Scoring analytics read path — feature 004.
 * Read-only; mutations to the underlying `bank_offer_decision` table land via a
 * future bank-decision-feed feature.
 */
import { Module } from '@nestjs/common';
import { ScoringAnalyticsController } from './scoring-analytics.controller';
import { ScoringAnalyticsRepository } from './scoring-analytics.repository';
import { ScoringAnalyticsService } from './scoring-analytics.service';

@Module({
  controllers: [ScoringAnalyticsController],
  providers: [ScoringAnalyticsRepository, ScoringAnalyticsService],
  exports: [ScoringAnalyticsService],
})
export class ScoringAnalyticsModule {}
