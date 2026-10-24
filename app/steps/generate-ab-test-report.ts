/**
 * Step: Aggregate persona picks into overall winner + qualitative summary / rollups.
 */

import { AbTestService } from "@/lib/services/ab-test.service";
import type { AbTestReport, AbTestWorkflowInput, PersonaAbResult } from "@/lib/types";

export async function generateAbTestReportStep(
  input: AbTestWorkflowInput,
  byPersona: PersonaAbResult[]
): Promise<AbTestReport> {
  "use step";

  const service = new AbTestService();
  return service.buildReport(input, byPersona);
}
