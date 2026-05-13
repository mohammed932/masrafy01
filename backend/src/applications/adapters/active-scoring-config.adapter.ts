/**
 * Single bridge between the scoring-versions registry and the matching engine.
 *
 * The matching pipeline (`src/matching/`) is forbidden from importing the registry
 * directly (Constitution Principle V; enforced by the ESLint boundary rule). The
 * orchestrator (`applications.service.ts`) calls this thin adapter exactly once per
 * apply request to hydrate the active `ScoringConfig` value object, then passes it
 * into `engine.run({ ..., scoringConfig })` as a pure parameter.
 *
 * Keeping this in `applications/adapters/` rather than `matching/` is intentional:
 * the engine never imports it; the orchestrator does.
 */
import type { ScoringConfig } from '@/matching/types';
import type { ScoringEngineVersionService } from '@/scoring-versions/scoring-versions.service';

export function loadActiveScoringConfig(
  service: ScoringEngineVersionService,
): Promise<ScoringConfig> {
  return service.getActiveConfig();
}
