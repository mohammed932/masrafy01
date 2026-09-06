-- Drop both scoring systems.
--
-- Two of them were stacked: `scoring_engine_version.weightsConfig` fed a rule-based scorer
-- that ran on every offer, and `scoring_weight_set` fed a per-program, per-answer one that
-- OVERWROTE that number whenever the application carried questionnaire answers. Neither
-- output survives (`20260906090100`), so neither input has a reader.
--
-- `scoring_engine_version` also held the string stamped onto `bank_offer.engineVersion`.
-- That column stays and keeps its job; the value now comes from `MATCHING_ENGINE_VERSION`
-- in `src/matching/types.ts`, which is where a fact about the code belongs. Historical rows
-- keep '1.1.0-init' / 'seed', which remain true statements.
--
-- DEPLOY ORDER IS NOT OPTIONAL. `ScoringEngineVersionService.onModuleInit` THROWS when no
-- active row exists -- a boot loop, not a degraded endpoint -- so an old artifact must not
-- be running when this lands. Stop the old process, `migrate deploy`, start the new build.
-- After this, nothing at boot reads a seeded row at all, which is strictly better.
DROP TABLE "scoring_weight_set";
DROP TYPE  "ScoringWeightSetStatus";

DROP TABLE "scoring_engine_version";

-- NOT touched: "AuditEventType" keeps 'SCORING_WEIGHTS_SAVED' and
-- 'SCORING_ENGINE_VERSION_PROMOTED'. `audit_event` is append-only (Principle VI) and live
-- rows carry both values, so dropping them would mean recreating the enum type against the
-- audit log -- rewriting history to tidy a name. They are retired in code and retained in
-- the type, the same treatment BANK_POLICY_UPDATED already has.
