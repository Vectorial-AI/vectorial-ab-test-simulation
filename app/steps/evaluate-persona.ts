/**
 * Step: Evaluate one persona across all A/B artifacts (qualitative).
 */

import { AbTestService } from "@/lib/services/ab-test.service";
import type {
  AbTestWorkflowInput,
  AudiencePersona,
  PersonaAbResult,
} from "@/lib/types";

export async function evaluatePersonaStep(
  persona: AudiencePersona,
  input: AbTestWorkflowInput
): Promise<PersonaAbResult> {
  "use step";

  const service = new AbTestService();
  return service.evaluatePersona(persona, input);
}
