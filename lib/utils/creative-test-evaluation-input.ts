/**
 * Same human_input shape as vectorial-social-wall-posts combined A/B eval:
 * variants described as text (URL + summary + body) — never vision / base64.
 */

import type { CreativeEvaluationContext, UploadArtifact } from "@/lib/types";

function urlLabelFor(contentType?: string): string {
  if (contentType === "video") return "Video URL";
  if (contentType === "pdf") return "PDF URL";
  if (contentType === "text") return "Text URL";
  return "Image URL";
}

function formatVariantBlock(artifact: UploadArtifact, index: number): string {
  const lines: string[] = [`${index + 1}. ${artifact.label} (id: ${artifact.id})`];
  if (artifact.uploadImageUrl?.trim() && !artifact.uploadImageUrl.startsWith("data:")) {
    lines.push(`   ${urlLabelFor(artifact.uploadContentType)}: ${artifact.uploadImageUrl.trim()}`);
  }
  if (artifact.uploadContentType) {
    lines.push(`   Type: ${artifact.uploadContentType}`);
  }
  if (artifact.uploadSummary?.trim()) {
    lines.push(
      "   Summary:",
      `   ${artifact.uploadSummary.trim().split("\n").join("\n   ")}`
    );
  }
  if (artifact.uploadText?.trim()) {
    lines.push("   Text body:", `   ${artifact.uploadText.trim().split("\n").join("\n   ")}`);
  }
  return lines.join("\n");
}

export function formatCreativeTestVariantLines(artifacts: UploadArtifact[]): string {
  return artifacts.map((a, i) => formatVariantBlock(a, i)).join("\n\n").trim();
}

/** Combined-mode latest message — same skeleton as social-wall, qualitative JSON contract. */
export function buildCombinedQualitativeLatestMessage(params: {
  displayText: string;
  backgroundQuery: string;
  personaName: string;
  artifacts: UploadArtifact[];
}): string {
  const creativeVariants = formatCreativeTestVariantLines(params.artifacts);
  const variantIds = params.artifacts.map((v) => v.id).join(", ");
  const escapedPersonaName = params.personaName.replace(/"/g, '\\"');

  return [
    "=== CREATIVE TEST TASK ===",
    "",
    `Post / test title: ${params.displayText.trim()}`,
    "",
    "What the team wants to learn:",
    params.backgroundQuery.trim(),
    "",
    "=== CREATIVE VARIANTS ===",
    "",
    creativeVariants,
    "",
    "Respond with JSON only.",
    `persona_name must be "${escapedPersonaName}".`,
    `Include artifact_feedback for every variant id listed above: ${variantIds}.`,
    "Pick exactly one best_aligned_variant_id from those ids.",
    "Do not return hook_rate, click_intent, CTR, or any 0–1 scores.",
  ].join("\n");
}

export function buildQualitativeSystemInput(params: {
  evaluationSystemPrompt: string;
  historicalContext?: string;
  additionalKnownSignals?: string;
  creativeEvaluation?: CreativeEvaluationContext;
}): string {
  const parts: string[] = [];

  if (params.historicalContext?.trim()) {
    parts.push(
      "HISTORICAL CREATIVE CALIBRATION (use as prior, not as a hard rule):",
      params.historicalContext.trim()
    );
  }
  if (params.additionalKnownSignals?.trim()) {
    parts.push("ADDITIONAL KNOWN SIGNALS:", params.additionalKnownSignals.trim());
  }
  if (params.creativeEvaluation) {
    const { campaignGoal, platform, funnelStage } = params.creativeEvaluation;
    const bits = [
      campaignGoal ? `Campaign goal: ${campaignGoal}` : null,
      platform ? `Platform: ${platform}` : null,
      funnelStage ? `Funnel stage: ${funnelStage}` : null,
    ].filter(Boolean);
    if (bits.length) {
      parts.push("CAMPAIGN CONTEXT:", bits.join("\n"));
    }
  }

  parts.push(params.evaluationSystemPrompt);
  return parts.join("\n\n").trim();
}

/** Optional retrieval_query — summaries only, same idea as social-wall eval retrieval. */
export function buildQualitativeEvalRetrievalQuery(params: {
  displayText: string;
  backgroundQuery: string;
  personaName: string;
  artifacts: UploadArtifact[];
}): string | undefined {
  const withSummary = params.artifacts.filter((a) => a.uploadSummary?.trim());
  if (withSummary.length === 0) return undefined;

  const lines = [
    `Post / test title: ${params.displayText.trim()}`,
    "",
    "What the team wants to learn:",
    params.backgroundQuery.trim(),
    "",
    `Persona: ${params.personaName}`,
    "",
    "=== CREATIVE VARIANTS ===",
    "",
  ];

  for (let i = 0; i < params.artifacts.length; i++) {
    const a = params.artifacts[i];
    lines.push(`${i + 1}. ${a.label} (id: ${a.id})`);
    if (a.uploadSummary?.trim()) {
      lines.push("   Summary:", `   ${a.uploadSummary.trim().split("\n").join("\n   ")}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}
