import { evaluatePersonaStep } from "@/app/steps/evaluate-persona";
import { generateAbTestReportStep } from "@/app/steps/generate-ab-test-report";
import { updateProgress } from "@/app/steps/update-progress";
import type {
  AbTestWorkflowInput,
  AbTestWorkflowOutput,
  PersonaAbResult,
} from "@/lib/types";

const TOTAL_STEPS = 3;

/**
 * Qualitative A/B test pipeline (Vercel Workflow).
 *
 * Same durable orchestration pattern as vectorial-social-wall-posts creative A/B,
 * without hook_rate / click_intent / polls / social-wall comments.
 *
 * 1. For each persona, compare all artifacts → concrete feedback + best-aligned pick
 * 2. Aggregate persona picks into an overall winner
 * 3. Distill cross-persona rollups + summary
 */
export async function abTestWorkflow(
  input: AbTestWorkflowInput
): Promise<AbTestWorkflowOutput> {
  "use workflow";

  const trackingId = input.runId;

  try {
    await updateProgress(trackingId, {
      currentStep: 1,
      totalSteps: TOTAL_STEPS,
      stepName: "evaluate_personas",
      percentage: 10,
      message: `Evaluating ${input.artifacts.length} artifacts across ${input.personas.length} persona(s)…`,
    });

    const byPersona: PersonaAbResult[] = [];
    for (let i = 0; i < input.personas.length; i++) {
      const persona = input.personas[i];
      const pct = 10 + Math.round(((i + 1) / input.personas.length) * 60);
      await updateProgress(trackingId, {
        currentStep: 1,
        stepName: "evaluate_personas",
        percentage: pct,
        message: `Persona ${i + 1}/${input.personas.length}: ${persona.name}`,
      });
      byPersona.push(await evaluatePersonaStep(persona, input));
    }

    await updateProgress(trackingId, {
      currentStep: 2,
      stepName: "aggregate_winner",
      percentage: 80,
      message: "Computing overall winner across personas…",
    });

    await updateProgress(trackingId, {
      currentStep: 3,
      stepName: "generate_summary",
      percentage: 90,
      message: "Writing qualitative summary and artifact rollups…",
    });

    const report = await generateAbTestReportStep(input, byPersona);

    await updateProgress(trackingId, {
      currentStep: TOTAL_STEPS,
      stepName: "completed",
      percentage: 100,
      message: "A/B test complete",
    });

    return { status: "completed", result: report };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown A/B test failure";
    await updateProgress(trackingId, {
      currentStep: TOTAL_STEPS,
      stepName: "failed",
      percentage: 100,
      message,
    });
    return { status: "failed", error: message };
  }
}
