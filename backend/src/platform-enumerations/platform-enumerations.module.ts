import { Module } from '@nestjs/common';
import { InMemoryPlatformEnumerationsRepository } from './in-memory-platform-enumerations.repository';
import { PlatformEnumerationsController } from './platform-enumerations.controller';
import { PlatformEnumerationsRepository } from './platform-enumerations.repository';

/**
 * Read-only enumeration registry consumer.
 * Today: bound to the in-memory stub (research.md R4).
 * Tomorrow (feature 003): swap the provider to a Postgres-backed implementation
 *   that implements the same `PlatformEnumerationsRepository` interface — zero
 *   call-site changes.
 */
@Module({
  controllers: [PlatformEnumerationsController],
  providers: [
    {
      provide: PlatformEnumerationsRepository,
      useClass: InMemoryPlatformEnumerationsRepository,
    },
  ],
  exports: [PlatformEnumerationsRepository],
})
export class PlatformEnumerationsModule {}
