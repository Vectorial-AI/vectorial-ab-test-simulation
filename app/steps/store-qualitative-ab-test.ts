/**
 * Step: Persist qualitative A/B test to tenant DB.
 * Table: "QualitativeAbTest" (never SocialWallPost).
 */

import { QualitativeAbTestService } from "@/lib/services/qualitative-ab-test.service";
import type { AbTestReport, AbTestWorkflowInput } from "@/lib/types";

export async function storeQualitativeAbTestStep(
  input: AbTestWorkflowInput,
  report: AbTestReport
): Promise<void> {
  "use step";

  const service = new QualitativeAbTestService();
  await service.upsertFromWorkflow(input, report);
}
