/**
 * Create QualitativeAbTest table on the beta Postgres database.
 *
 * NEW TABLE only — does not alter or reuse SocialWallPost.
 *
 * Usage:
 *   npx tsx scripts/migrate-beta-qualitative-ab-test-schema.ts
 *
 * Environment (one required):
 *   BETA_DIRECT_DATABASE_URL
 *   BETA_DATABASE_URL
 *
 * Loads `.env.local` from the project root.
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { PostgresClient } from "../lib/utils/postgres";

const MIGRATION_SQL = `
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
`.trim();

function assertSafeSql(sql: string): void {
  const forbidden = [/\bdrop\b/i, /\btruncate\b/i, /\bdelete\s+from\b/i, /\bsocialwallpost\b/i];
  for (const re of forbidden) {
    if (re.test(sql)) {
      throw new Error(`Migration guard: forbidden pattern (${re})`);
    }
  }
}

function getBetaDatabaseUrl(): string {
  const url = process.env.BETA_DATABASE_URL ?? process.env.BETA_DIRECT_DATABASE_URL;
  if (!url?.trim()) {
    throw new Error(
      "Missing BETA_DATABASE_URL or BETA_DIRECT_DATABASE_URL (Postgres connection string for beta)."
    );
  }
  return url.trim();
}

async function main(): Promise<void> {
  assertSafeSql(MIGRATION_SQL);

  const connectionString = getBetaDatabaseUrl();
  const db = new PostgresClient(connectionString);

  console.log(
    'Creating "QualitativeAbTest" on beta (IF NOT EXISTS) — does not touch SocialWallPost…'
  );

  await db.withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(MIGRATION_SQL);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  });

  const verify = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'QualitativeAbTest'`
  );

  if (verify.rowCount !== 1) {
    throw new Error('Verification failed: "QualitativeAbTest" not found after migration');
  }

  console.log("Done. QualitativeAbTest is ready on beta.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
