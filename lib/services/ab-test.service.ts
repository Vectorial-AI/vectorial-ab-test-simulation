import {
  PERSONA_QUALITATIVE_EVAL_SYSTEM,
  buildPersonaQualitativeUserMessage,
} from "@/lib/prompts/persona-qualitative-eval";
import {
  OVERALL_SUMMARY_SYSTEM,
  buildOverallSummaryUserMessage,
} from "@/lib/prompts/overall-summary";
import { OpenAIService } from "@/lib/services/openai.service";
import { computeOverallWinner } from "@/lib/utils/winner";
import type {
  AbTestReport,
  AbTestWorkflowInput,
  AlignmentStrength,
  ArtifactFeedback,
  AudiencePersona,
  PersonaAbResult,
  UploadArtifact,
} from "@/lib/types";

function parseAlignmentStrength(raw: unknown): AlignmentStrength {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "strong" || s === "moderate" || s === "weak" || s === "misaligned") return s;
  return "moderate";
}

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

export class AbTestService {
  private readonly openai = new OpenAIService();

  async evaluatePersona(
    persona: AudiencePersona,
    input: AbTestWorkflowInput
  ): Promise<PersonaAbResult> {
    const userText = buildPersonaQualitativeUserMessage({
      displayText: input.displayText,
      backgroundQuery: input.backgroundQuery,
      personaName: persona.name,
      personaDescription: persona.description,
      creativeEvaluation: input.creativeEvaluation,
      historicalContext: input.historicalContext,
      additionalKnownSignals: input.additionalKnownSignals,
      artifacts: input.artifacts.map((a) => ({
        id: a.id,
        label: a.label,
        uploadContentType: a.uploadContentType,
        uploadSummary: a.uploadSummary,
        uploadText: a.uploadText,
        uploadImageUrl: a.uploadImageUrl,
      })),
    });

    const imageUrls = input.artifacts
      .map((a) => a.uploadImageUrl)
      .filter((u): u is string => Boolean(u?.trim()));

    const raw = await this.openai.completeJson({
      system: PERSONA_QUALITATIVE_EVAL_SYSTEM,
      userText,
      imageUrls,
    });

    return this.parsePersonaResult(persona, input.artifacts, raw);
  }

  parsePersonaResult(
    persona: AudiencePersona,
    artifacts: UploadArtifact[],
    rawJson: string
  ): PersonaAbResult {
    const parsed = JSON.parse(rawJson) as {
      artifact_feedback?: Array<Record<string, unknown>>;
      best_aligned_variant_id?: string;
      best_aligned_variant_label?: string;
      why_best_aligned?: string;
    };

    const byId = new Map(artifacts.map((a) => [a.id, a]));
    const feedbackRows = Array.isArray(parsed.artifact_feedback) ? parsed.artifact_feedback : [];

    const artifactFeedback: ArtifactFeedback[] = artifacts.map((artifact) => {
      const row =
        feedbackRows.find((r) => String(r.variant_id ?? "") === artifact.id) ??
        feedbackRows.find((r) => String(r.variant_label ?? "") === artifact.label);

      return {
        variantId: artifact.id,
        variantLabel: artifact.label,
        overallImpression:
          typeof row?.overall_impression === "string" ? row.overall_impression : "",
        whatResonated: asStringArray(row?.what_resonated),
        whatMissed: asStringArray(row?.what_missed),
        alignmentNotes: typeof row?.alignment_notes === "string" ? row.alignment_notes : "",
        alignmentStrength: parseAlignmentStrength(row?.alignment_strength),
        concreteSuggestion:
          typeof row?.concrete_suggestion === "string" ? row.concrete_suggestion : "",
      };
    });

    let bestId =
      typeof parsed.best_aligned_variant_id === "string"
        ? parsed.best_aligned_variant_id.trim()
        : "";
    if (!byId.has(bestId)) {
      // Fallback: strongest alignment, else first artifact
      const ranked = [...artifactFeedback].sort((a, b) => {
        const order: Record<AlignmentStrength, number> = {
          strong: 0,
          moderate: 1,
          weak: 2,
          misaligned: 3,
        };
        return order[a.alignmentStrength] - order[b.alignmentStrength];
      });
      bestId = ranked[0]?.variantId ?? artifacts[0]?.id ?? "";
    }

    const best = byId.get(bestId) ?? artifacts[0];

    return {
      personaId: persona.id,
      personaName: persona.name,
      artifactFeedback,
      bestAlignedVariantId: best?.id ?? bestId,
      bestAlignedVariantLabel:
        (typeof parsed.best_aligned_variant_label === "string" &&
        parsed.best_aligned_variant_label.trim()
          ? parsed.best_aligned_variant_label.trim()
          : best?.label) ?? "Unknown",
      whyBestAligned:
        typeof parsed.why_best_aligned === "string" ? parsed.why_best_aligned : "",
    };
  }

  async buildReport(
    input: AbTestWorkflowInput,
    byPersona: PersonaAbResult[]
  ): Promise<AbTestReport> {
    const winnerCore = computeOverallWinner(byPersona, input.artifacts);

    const summaryRaw = await this.openai.completeJson({
      system: OVERALL_SUMMARY_SYSTEM,
      userText: buildOverallSummaryUserMessage({
        displayText: input.displayText,
        winnerVariantId: winnerCore.variantId,
        winnerVariantLabel: winnerCore.variantLabel,
        voteCount: winnerCore.voteCount,
        totalPersonas: winnerCore.totalPersonas,
        wasTie: winnerCore.wasTie,
        byPersona: byPersona.map((p) => ({
          personaName: p.personaName,
          bestAlignedVariantId: p.bestAlignedVariantId,
          bestAlignedVariantLabel: p.bestAlignedVariantLabel,
          whyBestAligned: p.whyBestAligned,
          artifactFeedback: p.artifactFeedback.map((f) => ({
            variantId: f.variantId,
            variantLabel: f.variantLabel,
            overallImpression: f.overallImpression,
            whatResonated: f.whatResonated,
            whatMissed: f.whatMissed,
            alignmentStrength: f.alignmentStrength,
          })),
        })),
        artifacts: input.artifacts.map((a) => ({ id: a.id, label: a.label })),
      }),
      temperature: 0.3,
    });

    const summaryParsed = JSON.parse(summaryRaw) as {
      summary?: string;
      winner_rationale?: string;
      artifact_rollups?: Array<{
        variant_id?: string;
        variant_label?: string;
        common_strengths?: unknown;
        common_concerns?: unknown;
      }>;
    };

    const rollupsFromModel = Array.isArray(summaryParsed.artifact_rollups)
      ? summaryParsed.artifact_rollups
      : [];

    const artifactRollups = input.artifacts.map((a) => {
      const modelRow = rollupsFromModel.find((r) => r.variant_id === a.id);
      const personasWhoChoseIt = byPersona
        .filter((p) => p.bestAlignedVariantId === a.id)
        .map((p) => p.personaName);

      return {
        variantId: a.id,
        variantLabel: a.label,
        personasWhoChoseIt,
        commonStrengths: asStringArray(modelRow?.common_strengths),
        commonConcerns: asStringArray(modelRow?.common_concerns),
      };
    });

    return {
      id: input.runId,
      summary:
        typeof summaryParsed.summary === "string" && summaryParsed.summary.trim()
          ? summaryParsed.summary.trim()
          : `Across ${byPersona.length} persona(s), ${winnerCore.variantLabel} aligned most often.`,
      byPersona,
      overallWinner: {
        ...winnerCore,
        rationale:
          typeof summaryParsed.winner_rationale === "string" &&
          summaryParsed.winner_rationale.trim()
            ? summaryParsed.winner_rationale.trim()
            : `${winnerCore.variantLabel} was best-aligned for ${winnerCore.voteCount} of ${winnerCore.totalPersonas} persona(s).`,
      },
      artifactRollups,
    };
  }
}
