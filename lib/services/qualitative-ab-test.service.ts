import { Settings } from "@/lib/config/settings";
import { PostgresClient } from "@/lib/utils/postgres";
import type {
  AbTestReport,
  AbTestWorkflowInput,
  AudiencePersona,
  CreativeEvaluationContext,
  UploadArtifact,
} from "@/lib/types";

export interface UpsertQualitativeAbTestInput {
  id: string;
  enterpriseName: string;
  userId: string;
  userEmail: string;
  displayText: string;
  backgroundQuery: string;
  personas: AudiencePersona[];
  artifacts: UploadArtifact[];
  creativeEvaluation?: CreativeEvaluationContext | null;
  historicalContext?: string | null;
  additionalKnownSignals?: string | null;
  report: AbTestReport;
  vercelRunId?: string | null;
}

/**
 * Persistence for qualitative A/B tests.
 * Writes to "QualitativeAbTest" — never SocialWallPost.
 */
export class QualitativeAbTestService {
  private readonly settings = Settings.getInstance();

  async upsert(input: UpsertQualitativeAbTestInput): Promise<void> {
    const dbUrl = this.settings.getEnterpriseDirectDbUrl(input.enterpriseName);
    const db = new PostgresClient(dbUrl);
    const now = new Date();

    await db.query(
      `
        INSERT INTO "QualitativeAbTest" (
          "id",
          "createdAt",
          "updatedAt",
          "userId",
          "userEmail",
          "enterpriseName",
          "displayText",
          "backgroundQuery",
          "personas",
          "artifacts",
          "creativeEvaluation",
          "historicalContext",
          "additionalKnownSignals",
          "report",
          "vercelRunId"
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14::jsonb, $15
        )
        ON CONFLICT ("id")
        DO UPDATE SET
          "updatedAt" = EXCLUDED."updatedAt",
          "userId" = EXCLUDED."userId",
          "userEmail" = EXCLUDED."userEmail",
          "enterpriseName" = EXCLUDED."enterpriseName",
          "displayText" = EXCLUDED."displayText",
          "backgroundQuery" = EXCLUDED."backgroundQuery",
          "personas" = EXCLUDED."personas",
          "artifacts" = EXCLUDED."artifacts",
          "creativeEvaluation" = EXCLUDED."creativeEvaluation",
          "historicalContext" = EXCLUDED."historicalContext",
          "additionalKnownSignals" = EXCLUDED."additionalKnownSignals",
          "report" = EXCLUDED."report",
          "vercelRunId" = EXCLUDED."vercelRunId"
      `,
      [
        input.id,
        now,
        now,
        input.userId,
        input.userEmail,
        input.enterpriseName,
        input.displayText,
        input.backgroundQuery,
        JSON.stringify(input.personas),
        JSON.stringify(input.artifacts),
        input.creativeEvaluation ? JSON.stringify(input.creativeEvaluation) : null,
        input.historicalContext ?? null,
        input.additionalKnownSignals ?? null,
        JSON.stringify(input.report),
        input.vercelRunId ?? null,
      ]
    );
  }

  /** Convenience: persist from workflow input + finished report. */
  async upsertFromWorkflow(
    input: AbTestWorkflowInput,
    report: AbTestReport,
    vercelRunId?: string | null
  ): Promise<void> {
    await this.upsert({
      id: input.runId,
      enterpriseName: input.enterpriseName,
      userId: input.userId,
      userEmail: input.userEmail,
      displayText: input.displayText,
      backgroundQuery: input.backgroundQuery,
      personas: input.personas,
      artifacts: input.artifacts,
      creativeEvaluation: input.creativeEvaluation ?? null,
      historicalContext: input.historicalContext ?? null,
      additionalKnownSignals: input.additionalKnownSignals ?? null,
      report,
      vercelRunId: vercelRunId ?? null,
    });
  }
}
