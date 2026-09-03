/**
 * The Nest context `npm run seed:blueprints` boots — deliberately NOT `AppModule`.
 *
 * Why a context at all: `BlueprintService` is what an operator's clicks used to go through,
 * and reusing it is the whole point — a seeded product comes out identical to one the UI
 * produced, with the same refusals, the same single questionnaire publish and the same
 * audited writes. It injects four providers and sits in a declared three-module `forwardRef`
 * cycle, so it cannot be hand-constructed the way `EngineService` is in the demo seeds.
 *
 * Why not `AppModule`, and this is not a preference: it imports `BootstrapModule`, whose
 * `AdminSeederService.onApplicationBootstrap` RESETS the existing super-admin's password to
 * `SEED_ADMIN_PASSWORD` on every boot — and `createApplicationContext` runs bootstrap hooks.
 * Building the product library would quietly change somebody's login. It would also start an
 * S3 client and a scheduler this has no use for.
 *
 * What this module still costs, stated rather than discovered:
 *   · the FULL env is validated, not just `DATABASE_URL` — `loadEnv` demands `REDIS_URL`, the
 *     JWT secrets, `COOKIE_DOMAIN` and the `S3_*` block. Unlike every other seed, this one
 *     will not run on a bare database URL;
 *   · `RedisService` connects eagerly, which is why the command must `app.close()` or the
 *     process hangs after the report;
 *   · `AuthModule`'s own bootstrap hook runs — an idempotent no-op when an admin exists;
 *   · `PostgresPlatformEnumerationsRepository.onModuleInit` throws on an EMPTY
 *     `platform_enumeration` table. That is wanted: the seed refuses clearly on a database
 *     that has never been migrated or seeded, instead of half-building a library on it.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InfraModule } from '@/infra/infra.module';
import { BankProgramsModule } from '@/bank-programs/bank-programs.module';
import { loadEnv } from '@/infra/env/env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (raw) => loadEnv(raw as NodeJS.ProcessEnv),
    }),
    InfraModule,
    // Pulls Auth, CustomerAuth, PlatformEnumerations, Questionnaire and Audit transitively,
    // so the module graph resolves `BlueprintService`'s dependencies exactly as it does at
    // runtime — forwardRef cycles included.
    BankProgramsModule,
  ],
})
export class BlueprintSeedModule {}
