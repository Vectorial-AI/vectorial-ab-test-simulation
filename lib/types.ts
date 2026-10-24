/** Alignment strength — qualitative, not a 0–1 score. */
export type AlignmentStrength = "strong" | "moderate" | "weak" | "misaligned";

export type UploadContentType = "image" | "video" | "text" | "pdf" | "landing_page";

export interface AudiencePersona {
  id: string;
  name: string;
  /** Optional description / background for the persona simulation. */
  description?: string;
}

export interface UploadArtifact {
  id: string;
  label: string;
  uploadImageUrl?: string;
  uploadContentType?: UploadContentType;
  /** Text/markdown body when the artifact is copy or a concept brief. */
  uploadText?: string;
  uploadSummary?: string;
}

export interface CreativeEvaluationContext {
  campaignGoal?: string;
  platform?: string;
  funnelStage?: string;
}

export interface AbTestWorkflowInput {
  /** Self-generated tracking id (set in API before start()). */
  runId: string;
  displayText: string;
  backgroundQuery: string;
  personas: AudiencePersona[];
  artifacts: UploadArtifact[];
  creativeEvaluation?: CreativeEvaluationContext;
  historicalContext?: string;
  additionalKnownSignals?: string;
}

/** Concrete qualitative feedback for one artifact from one persona. */
export interface ArtifactFeedback {
  variantId: string;
  variantLabel: string;
  /** First-person, concrete reaction to this artifact. */
  overallImpression: string;
  whatResonated: string[];
  whatMissed: string[];
  /** How well this artifact fits this persona's world, in plain language. */
  alignmentNotes: string;
  alignmentStrength: AlignmentStrength;
  /** Specific, actionable note — what would make this better for this persona. */
  concreteSuggestion: string;
}

/** One persona's full A/B comparison result. */
export interface PersonaAbResult {
  personaId: string;
  personaName: string;
  artifactFeedback: ArtifactFeedback[];
  /** Variant this persona says aligned most. */
  bestAlignedVariantId: string;
  bestAlignedVariantLabel: string;
  /** Why this persona picked that variant over the others. */
  whyBestAligned: string;
}

export interface PersonaVote {
  personaId: string;
  personaName: string;
  choseVariantId: string;
  choseVariantLabel: string;
}

export interface OverallWinner {
  variantId: string;
  variantLabel: string;
  /** How many personas chose this variant as best-aligned. */
  voteCount: number;
  totalPersonas: number;
  rationale: string;
  personaVotes: PersonaVote[];
  /** True when two or more variants tied for most persona picks. */
  wasTie: boolean;
  /** Runner-up when useful for the summary. */
  runnerUp?: {
    variantId: string;
    variantLabel: string;
    voteCount: number;
  };
}

export interface AbTestReport {
  summary: string;
  byPersona: PersonaAbResult[];
  overallWinner: OverallWinner;
  /** Per-artifact rollup across personas (qualitative, not scored). */
  artifactRollups: Array<{
    variantId: string;
    variantLabel: string;
    personasWhoChoseIt: string[];
    commonStrengths: string[];
    commonConcerns: string[];
  }>;
}

/** Durable workflow return envelope (same pattern as social-wall-posts). */
export type AbTestWorkflowOutput =
  | { status: "completed"; result: AbTestReport }
  | { status: "failed"; error: string };

export interface StartAbTestResponse {
  status: "processing";
  runId: string;
  message: string;
  statusUrl: string;
}
