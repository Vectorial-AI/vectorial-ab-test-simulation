/**
 * Step: Combined-mode qualitative A/B eval for one audience-room persona.
 * Same chat-agent path as social-wall evaluatePersonaAllVariantsStep.
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

evaluatePersonaStep.maxRetries = 3;
