import type {
  OverallWinner,
  PersonaAbResult,
  PersonaVote,
  UploadArtifact,
} from "@/lib/types";

/**
 * Overall winner = variant chosen as best-aligned by the most personas.
 * Ties: keep the first highest-vote variant in artifact order; flag wasTie.
 */
export function computeOverallWinner(
  byPersona: PersonaAbResult[],
  artifacts: UploadArtifact[]
): Omit<OverallWinner, "rationale"> {
  const votes: PersonaVote[] = byPersona.map((p) => ({
    personaId: p.personaId,
    personaName: p.personaName,
    choseVariantId: p.bestAlignedVariantId,
    choseVariantLabel: p.bestAlignedVariantLabel,
  }));

  const counts = new Map<string, number>();
  for (const v of votes) {
    counts.set(v.choseVariantId, (counts.get(v.choseVariantId) ?? 0) + 1);
  }

  const ordered = artifacts.map((a) => ({
    variantId: a.id,
    variantLabel: a.label,
    voteCount: counts.get(a.id) ?? 0,
  }));

  ordered.sort((a, b) => {
    if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
    return artifacts.findIndex((x) => x.id === a.variantId) - artifacts.findIndex((x) => x.id === b.variantId);
  });

  const top = ordered[0] ?? {
    variantId: artifacts[0]?.id ?? "unknown",
    variantLabel: artifacts[0]?.label ?? "Unknown",
    voteCount: 0,
  };
  const second = ordered[1];
  const wasTie = Boolean(second && second.voteCount === top.voteCount && top.voteCount > 0);

  return {
    variantId: top.variantId,
    variantLabel: top.variantLabel,
    voteCount: top.voteCount,
    totalPersonas: byPersona.length,
    personaVotes: votes,
    wasTie,
    ...(second && second.voteCount > 0
      ? {
          runnerUp: {
            variantId: second.variantId,
            variantLabel: second.variantLabel,
            voteCount: second.voteCount,
          },
        }
      : {}),
  };
}
