/**
 * Combined-mode qualitative A/B evaluation.
 * Replaces hook_rate / click_intent with concrete persona feedback + a clear pick.
 */
export const PERSONA_QUALITATIVE_EVAL_SYSTEM = `You are simulating one specific target-audience persona comparing multiple creative artifacts in an A/B test.

You are NOT a marketer, strategist, designer, researcher, or analyst.
You ARE the persona described in the input — react from their lived motivations, concerns, habits, and decision style.

Your job:
1. Give concrete, qualitative feedback on EACH artifact separately.
2. Say which single artifact aligned most with you (this persona), and why.

Do NOT return numeric scores like hook rate, click intent, CTR, or 0–1 ratings.
Do NOT write generic creative-critique jargon.
Be honest and discriminating — do not make every artifact sound good.

Use first-person language where useful:
"I notice…"
"I would probably…"
"This makes me feel…"
"I'm not convinced because…"
"I would ignore this because…"

FEEDBACK RULES
- overall_impression: 3–6 sentences, specific to what you see/read in that artifact.
- what_resonated / what_missed: short concrete bullets (not vague praise).
- alignment_notes: how well this fits YOUR world, priorities, and skepticism.
- alignment_strength: one of strong | moderate | weak | misaligned
- concrete_suggestion: one practical change that would make THIS artifact work better for you.

COMPARISON RULES
- Evaluate every artifact.
- Pick exactly one best_aligned_variant_id from the provided variant ids.
- Explain the pick relatively (why this one over the others).
- If all feel weak, still pick the least-bad one and say so plainly in why_best_aligned.

Return ONLY valid JSON matching the schema in the user message. No markdown fences.`;

export function buildPersonaQualitativeUserMessage(input: {
  displayText: string;
  backgroundQuery: string;
  personaName: string;
  personaDescription?: string;
  creativeEvaluation?: {
    campaignGoal?: string;
    platform?: string;
    funnelStage?: string;
  };
  historicalContext?: string;
  additionalKnownSignals?: string;
  artifacts: Array<{
    id: string;
    label: string;
    uploadContentType?: string;
    uploadSummary?: string;
    uploadText?: string;
    uploadImageUrl?: string;
  }>;
}): string {
  const lines: string[] = [];

  lines.push(`PERSONA NAME: ${input.personaName}`);
  if (input.personaDescription?.trim()) {
    lines.push(`PERSONA BACKGROUND:\n${input.personaDescription.trim()}`);
  } else {
    lines.push(
      "PERSONA BACKGROUND: Use the persona name and any retrieved/contextual cues. Stay concrete; do not invent an unrelated biography."
    );
  }

  lines.push("");
  lines.push(`TEST PROMPT / DISPLAY TEXT:\n${input.displayText}`);
  lines.push("");
  lines.push(`BACKGROUND / COMPARISON BRIEF:\n${input.backgroundQuery}`);

  if (input.creativeEvaluation) {
    const { campaignGoal, platform, funnelStage } = input.creativeEvaluation;
    const bits = [
      campaignGoal ? `Campaign goal: ${campaignGoal}` : null,
      platform ? `Platform: ${platform}` : null,
      funnelStage ? `Funnel stage: ${funnelStage}` : null,
    ].filter(Boolean);
    if (bits.length) {
      lines.push("");
      lines.push(`CAMPAIGN CONTEXT:\n${bits.join("\n")}`);
    }
  }

  if (input.historicalContext?.trim()) {
    lines.push("");
    lines.push(
      `HISTORICAL CALIBRATION (use as prior, not as a hard rule):\n${input.historicalContext.trim()}`
    );
  }

  if (input.additionalKnownSignals?.trim()) {
    lines.push("");
    lines.push(`ADDITIONAL KNOWN SIGNALS:\n${input.additionalKnownSignals.trim()}`);
  }

  lines.push("");
  lines.push("ARTIFACTS TO COMPARE:");
  for (const a of input.artifacts) {
    lines.push(`---`);
    lines.push(`variant_id: ${a.id}`);
    lines.push(`variant_label: ${a.label}`);
    if (a.uploadContentType) lines.push(`content_type: ${a.uploadContentType}`);
    if (a.uploadSummary?.trim()) lines.push(`summary: ${a.uploadSummary.trim()}`);
    if (a.uploadText?.trim()) lines.push(`text_body:\n${a.uploadText.trim()}`);
    if (a.uploadImageUrl?.trim()) lines.push(`image_url: ${a.uploadImageUrl.trim()}`);
  }

  lines.push("");
  lines.push(`Return JSON with this exact shape:
{
  "artifact_feedback": [
    {
      "variant_id": "<id>",
      "variant_label": "<label>",
      "overall_impression": "<string>",
      "what_resonated": ["<string>", "..."],
      "what_missed": ["<string>", "..."],
      "alignment_notes": "<string>",
      "alignment_strength": "strong" | "moderate" | "weak" | "misaligned",
      "concrete_suggestion": "<string>"
    }
  ],
  "best_aligned_variant_id": "<one of the variant ids>",
  "best_aligned_variant_label": "<label>",
  "why_best_aligned": "<string explaining the pick vs the others>"
}

Include exactly one artifact_feedback object per artifact, covering every variant_id listed above.`);

  return lines.join("\n");
}
