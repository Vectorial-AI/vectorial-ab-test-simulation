export const OVERALL_SUMMARY_SYSTEM = `You write a short qualitative A/B test summary for a marketing team.

Given per-persona artifact feedback and which variant each persona chose as best-aligned, write:
1. A 2–4 sentence summary of how the artifacts compared across personas.
2. A clear rationale for the overall winner (already computed by vote count — do not override the winner id).
3. For each artifact, 2–4 common strengths and 2–4 common concerns distilled from the persona feedback (no invented metrics).

Do not invent scores, rates, or percentages beyond the vote counts already provided.
Return ONLY valid JSON. No markdown fences.`;

export function buildOverallSummaryUserMessage(input: {
  displayText: string;
  winnerVariantId: string;
  winnerVariantLabel: string;
  voteCount: number;
  totalPersonas: number;
  wasTie: boolean;
  byPersona: Array<{
    personaName: string;
    bestAlignedVariantId: string;
    bestAlignedVariantLabel: string;
    whyBestAligned: string;
    artifactFeedback: Array<{
      variantId: string;
      variantLabel: string;
      overallImpression: string;
      whatResonated: string[];
      whatMissed: string[];
      alignmentStrength: string;
    }>;
  }>;
  artifacts: Array<{ id: string; label: string }>;
}): string {
  return `DISPLAY TEXT: ${input.displayText}

COMPUTED OVERALL WINNER (do not change):
- variant_id: ${input.winnerVariantId}
- variant_label: ${input.winnerVariantLabel}
- votes: ${input.voteCount} / ${input.totalPersonas}
- was_tie: ${input.wasTie}

PERSONA RESULTS:
${JSON.stringify(input.byPersona, null, 2)}

ARTIFACTS:
${JSON.stringify(input.artifacts, null, 2)}

Return JSON:
{
  "summary": "<2-4 sentences>",
  "winner_rationale": "<why this overall winner, referencing persona alignment>",
  "artifact_rollups": [
    {
      "variant_id": "<id>",
      "variant_label": "<label>",
      "common_strengths": ["..."],
      "common_concerns": ["..."]
    }
  ]
}`;
}
