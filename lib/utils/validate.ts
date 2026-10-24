import type { AbTestWorkflowInput, AudiencePersona, UploadArtifact } from "@/lib/types";

const MIN_VARIANTS = 2;
const MAX_VARIANTS = 5;

/** Validated client payload — `runId` is assigned by the API before `start()`. */
export type AbTestRequestBody = Omit<AbTestWorkflowInput, "runId">;

export function validateAbTestBody(body: unknown): string | AbTestRequestBody {
  if (!body || typeof body !== "object") return "Request body must be a JSON object";
  const b = body as Record<string, unknown>;

  if (typeof b.displayText !== "string" || !b.displayText.trim()) {
    return "Missing or invalid 'displayText'";
  }
  if (typeof b.backgroundQuery !== "string" || !b.backgroundQuery.trim()) {
    return "Missing or invalid 'backgroundQuery'";
  }

  if (!Array.isArray(b.personas) || b.personas.length < 1) {
    return "Provide at least one persona in 'personas'";
  }

  const personas: AudiencePersona[] = [];
  for (let i = 0; i < b.personas.length; i++) {
    const p = b.personas[i];
    if (!p || typeof p !== "object") return `Invalid personas[${i}]`;
    const row = p as Record<string, unknown>;
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : `persona-${i + 1}`;
    const name = typeof row.name === "string" && row.name.trim() ? row.name.trim() : "";
    if (!name) return `Invalid personas[${i}].name`;
    const description =
      typeof row.description === "string" && row.description.trim()
        ? row.description.trim()
        : undefined;
    personas.push({ id, name, ...(description ? { description } : {}) });
  }

  // Accept uploadArtifacts (social-wall naming) or artifacts
  const rawArtifacts = Array.isArray(b.artifacts)
    ? b.artifacts
    : Array.isArray(b.uploadArtifacts)
      ? b.uploadArtifacts
      : null;

  if (!rawArtifacts) {
    return "Provide 2–5 items in 'artifacts' (or 'uploadArtifacts')";
  }
  if (rawArtifacts.length < MIN_VARIANTS || rawArtifacts.length > MAX_VARIANTS) {
    return `A/B test requires ${MIN_VARIANTS}–${MAX_VARIANTS} artifacts (got ${rawArtifacts.length})`;
  }

  const artifacts: UploadArtifact[] = [];
  for (let i = 0; i < rawArtifacts.length; i++) {
    const item = rawArtifacts[i];
    if (!item || typeof item !== "object") return `Invalid artifacts[${i}]`;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : `variant-${i + 1}`;
    const label =
      typeof row.label === "string" && row.label.trim()
        ? row.label.trim()
        : `Variant ${String.fromCharCode(65 + i)}`;
    const uploadImageUrl =
      typeof row.uploadImageUrl === "string"
        ? row.uploadImageUrl
        : typeof row.imageUrl === "string"
          ? row.imageUrl
          : undefined;
    const uploadText =
      typeof row.uploadText === "string"
        ? row.uploadText
        : typeof row.text === "string"
          ? row.text
          : undefined;
    const uploadSummary =
      typeof row.uploadSummary === "string"
        ? row.uploadSummary
        : typeof row.summary === "string"
          ? row.summary
          : undefined;
    const uploadContentType =
      typeof row.uploadContentType === "string" ? row.uploadContentType : undefined;

    if (!uploadImageUrl?.trim() && !uploadText?.trim() && !uploadSummary?.trim()) {
      return `artifacts[${i}] needs at least one of uploadImageUrl, uploadText, or uploadSummary`;
    }

    artifacts.push({
      id,
      label,
      ...(uploadImageUrl?.trim() ? { uploadImageUrl: uploadImageUrl.trim() } : {}),
      ...(uploadText?.trim() ? { uploadText: uploadText.trim() } : {}),
      ...(uploadSummary?.trim() ? { uploadSummary: uploadSummary.trim() } : {}),
      ...(uploadContentType
        ? { uploadContentType: uploadContentType as UploadArtifact["uploadContentType"] }
        : {}),
    });
  }

  const creativeEvaluation =
    b.creativeEvaluation && typeof b.creativeEvaluation === "object"
      ? (b.creativeEvaluation as AbTestWorkflowInput["creativeEvaluation"])
      : undefined;

  return {
    displayText: b.displayText.trim(),
    backgroundQuery: b.backgroundQuery.trim(),
    personas,
    artifacts,
    ...(creativeEvaluation ? { creativeEvaluation } : {}),
    ...(typeof b.historicalContext === "string" && b.historicalContext.trim()
      ? { historicalContext: b.historicalContext.trim() }
      : {}),
    ...(typeof b.additionalKnownSignals === "string" && b.additionalKnownSignals.trim()
      ? { additionalKnownSignals: b.additionalKnownSignals.trim() }
      : {}),
  };
}
