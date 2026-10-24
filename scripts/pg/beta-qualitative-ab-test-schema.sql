-- =============================================================================
-- Beta database: QualitativeAbTest table (NEW — not SocialWallPost)
-- =============================================================================
-- Dedicated persistence for the qualitative A/B test simulation workflow.
-- Does NOT touch "SocialWallPost" or any social-wall tables.
--
-- Run against the beta Postgres database:
--   psql "$BETA_DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/pg/beta-qualitative-ab-test-schema.sql
--
-- Or via the TS migrator:
--   npx tsx scripts/migrate-beta-qualitative-ab-test-schema.ts
--
-- Idempotent: CREATE TABLE / INDEX IF NOT EXISTS.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "QualitativeAbTest" (
  "id" text PRIMARY KEY,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "userId" text NOT NULL,
  "userEmail" text NOT NULL,
  "enterpriseName" text NOT NULL,
  "displayText" text NOT NULL,
  "backgroundQuery" text NOT NULL,
  "personas" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "artifacts" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "creativeEvaluation" jsonb,
  "historicalContext" text,
  "additionalKnownSignals" text,
  "report" jsonb NOT NULL,
  "vercelRunId" text
);

CREATE INDEX IF NOT EXISTS "QualitativeAbTest_enterpriseName_createdAt_idx"
  ON "QualitativeAbTest" ("enterpriseName", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "QualitativeAbTest_userId_createdAt_idx"
  ON "QualitativeAbTest" ("userId", "createdAt" DESC);

COMMIT;

-- Optional verify:
-- SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'QualitativeAbTest'
--   ORDER BY ordinal_position;
