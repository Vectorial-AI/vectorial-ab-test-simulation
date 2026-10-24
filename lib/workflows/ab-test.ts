import { AbTestService } from "@/lib/services/ab-test.service";
import { patchProgress } from "@/lib/utils/progress-store";
import type { AbTestReport, AbTestWorkflowInput } from "@/lib/types";

const TOTAL_STEPS = 3;

/**
 * A/B test pipeline (qualitative):
 * 1. For each persona, compare all artifacts and collect concrete feedback + best-aligned pick
 * 2. Aggregate persona picks into an overall winner
 * 3. Distill cross-persona rollups + summary
 *
 * Mirrors the social-wall-posts creative A/B evaluation path, without
 * hook_rate / click_intent / polls / social-wall comments.
 */
export async function runAbTestWorkflow(
  runId: string,
  input: AbTestWorkflowInput
): Promise<AbTestReport> {
  const service = new AbTestService();

  try {
    patchProgress(runId, {
      status: "running",
      currentStep: 1,
      totalSteps: TOTAL_STEPS,
      stepName: "evaluate_personas",
      percentage: 10,
      message: `Evaluating ${input.artifacts.length} artifacts across ${input.personas.length} persona(s)…`,
    });

    const byPersona = [];
    for (let i = 0; i < input.personas.length; i++) {
      const persona = input.personas[i];
      const pct = 10 + Math.round(((i + 1) / input.personas.length) * 60);
      patchProgress(runId, {
        currentStep: 1,
        stepName: "evaluate_personas",
        percentage: pct,
        message: `Persona ${i + 1}/${input.personas.length}: ${persona.name}`,
      });
      const result = await service.evaluatePersona(persona, input);
      byPersona.push(result);
    }

    patchProgress(runId, {
      currentStep: 2,
      stepName: "aggregate_winner",
      percentage: 80,
      message: "Computing overall winner across personas…",
    });

    patchProgress(runId, {
      currentStep: 3,
      stepName: "generate_summary",
      percentage: 90,
      message: "Writing qualitative summary and artifact rollups…",
    });

    const report = await service.buildReport(input, byPersona);

    patchProgress(runId, {
      status: "completed",
      currentStep: TOTAL_STEPS,
      stepName: "completed",
      percentage: 100,
      message: "A/B test complete",
      result: report,
    });

    return report;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown A/B test failure";
    patchProgress(runId, {
      status: "failed",
      stepName: "failed",
      percentage: 100,
      error: message,
      message,
    });
    throw err;
  }
}
