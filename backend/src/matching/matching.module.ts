/**
 * Matching module — provides EngineService and pipeline utilities.
 * Constitution Principle X: no direct Prisma access from the engine.
 */

import { Module } from '@nestjs/common';
import { EngineService } from './engine.service';

@Module({
  providers: [EngineService],
  exports: [EngineService],
})
export class MatchingModule {}
