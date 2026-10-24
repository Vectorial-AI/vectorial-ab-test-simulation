"use client";

import { useMemo, useState } from "react";
import type {
  AbTestReport,
  AlignmentStrength,
  AudiencePersona,
  UploadArtifact,
} from "@/lib/types";

type FormPersona = AudiencePersona;
type FormArtifact = UploadArtifact & { draftKey: string };

const DEFAULT_PERSONAS: FormPersona[] = [
  {
    id: "persona-1",
    name: "Design Leaders",
    description:
      "Senior product design leads at B2B SaaS companies. Care about craft, clarity, and credibility. Skeptical of hype and vague benefit claims.",
  },
  {
    id: "persona-2",
    name: "Growth PMs",
    description:
      "Growth-minded product managers who optimize activation and conversion. Want a clear next step and measurable value, not brand poetry.",
  },
];

const DEFAULT_ARTIFACTS: FormArtifact[] = [
  {
    draftKey: "a",
    id: "variant-a",
    label: "Variant A",
    uploadContentType: "text",
    uploadSummary: "Bold product screenshot with a direct launch CTA.",
    uploadText:
      "Headline: Ship design decisions faster.\nSub: One workspace for research, critique, and handoff.\nCTA: Start free trial",
  },
  {
    draftKey: "b",
    id: "variant-b",
    label: "Variant B",
    uploadContentType: "text",
    uploadSummary: "Customer-outcome focused with softer social proof.",
    uploadText:
      "Headline: Teams that align ship 2× more.\nSub: See how Stripe's design org cut review cycles in half.\nCTA: See customer stories",
  },
];

type StatusPayload = {
  status: string;
  percentage?: number;
  stepName?: string;
  message?: string;
  error?: string | null;
  result?: AbTestReport | null;
  progress?: {
    percentage?: number;
    stepName?: string;
    message?: string;
  } | null;
};

function strengthClass(s: AlignmentStrength): string {
  return `chip ${s}`;
}

export default function HomePage() {
  const [displayText, setDisplayText] = useState(
    "Which creative should we use for the launch announcement?"
  );
  const [backgroundQuery, setBackgroundQuery] = useState(
    "Compare the uploaded launch creatives and say which one would feel most aligned for each selected persona. Be concrete and qualitative — no hook-rate or click-intent scores."
  );
  const [campaignGoal, setCampaignGoal] = useState("Drive trial signups for a design collaboration tool");
  const [platform, setPlatform] = useState("LinkedIn");
  const [personas, setPersonas] = useState<FormPersona[]>(DEFAULT_PERSONAS);
  const [artifacts, setArtifacts] = useState<FormArtifact[]>(DEFAULT_ARTIFACTS);

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AbTestReport | null>(null);

  const canRun = useMemo(
    () =>
      displayText.trim() &&
      backgroundQuery.trim() &&
      personas.length >= 1 &&
      artifacts.length >= 2 &&
      artifacts.length <= 5 &&
      !running,
    [displayText, backgroundQuery, personas, artifacts, running]
  );

  function updatePersona(index: number, patch: Partial<FormPersona>) {
    setPersonas((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function updateArtifact(index: number, patch: Partial<FormArtifact>) {
    setArtifacts((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  async function runTest() {
    setRunning(true);
    setError(null);
    setReport(null);
    setStatus({ status: "processing", percentage: 0, message: "Starting…" });

    try {
      const res = await fetch("/api/ab-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayText,
          backgroundQuery,
          creativeEvaluation: {
            campaignGoal: campaignGoal || undefined,
            platform: platform || undefined,
          },
          personas: personas.map(({ id, name, description }) => ({
            id,
            name,
            description,
          })),
          artifacts: artifacts.map(
            ({ id, label, uploadImageUrl, uploadText, uploadSummary, uploadContentType }) => ({
              id,
              label,
              uploadImageUrl,
              uploadText,
              uploadSummary,
              uploadContentType,
            })
          ),
        }),
      });

      const start = await res.json();
      if (!res.ok) {
        throw new Error(start.error || `Start failed (${res.status})`);
      }

      const statusUrl: string = start.statusUrl;
      for (;;) {
        await new Promise((r) => setTimeout(r, 1200));
        const poll = await fetch(statusUrl);
        const data = (await poll.json()) as StatusPayload;
        if (!poll.ok) {
          throw new Error(data.error || `Status failed (${poll.status})`);
        }
        const progress = data.progress;
        setStatus({
          status: data.status,
          percentage: progress?.percentage ?? data.percentage,
          stepName: progress?.stepName ?? data.stepName,
          message: progress?.message ?? data.message,
          error: data.error,
          result: data.result,
          progress,
        });
        if (data.status === "completed" && data.result) {
          setReport(data.result);
          break;
        }
        if (data.status === "failed") {
          throw new Error(data.error || data.message || "Run failed");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="app-shell">
      <h1 className="brand">Vectorial A/B Test</h1>
      <p className="lede">
        Same A/B comparison pipeline as social-wall creative tests — without hook rate or click
        intent. Each persona gives concrete feedback on every artifact, picks which aligned most,
        then we crown an overall winner across selected personas.
      </p>

      <div className="grid-2">
        <section className="panel">
          <h2>Test setup</h2>

          <div className="field">
            <label htmlFor="displayText">Display text</label>
            <textarea
              id="displayText"
              value={displayText}
              onChange={(e) => setDisplayText(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="backgroundQuery">Background / brief</label>
            <textarea
              id="backgroundQuery"
              value={backgroundQuery}
              onChange={(e) => setBackgroundQuery(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="campaignGoal">Campaign goal</label>
            <input
              id="campaignGoal"
              value={campaignGoal}
              onChange={(e) => setCampaignGoal(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="platform">Platform</label>
            <input id="platform" value={platform} onChange={(e) => setPlatform(e.target.value)} />
          </div>

          <h2 style={{ marginTop: "1.25rem" }}>Personas</h2>
          <div className="list-block">
            {personas.map((p, i) => (
              <div className="item-card" key={p.id}>
                <header>
                  <h3>Persona {i + 1}</h3>
                  {personas.length > 1 ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setPersonas((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      Remove
                    </button>
                  ) : null}
                </header>
                <div className="field">
                  <label>Name</label>
                  <input
                    value={p.name}
                    onChange={(e) => updatePersona(i, { name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Description</label>
                  <textarea
                    value={p.description ?? ""}
                    onChange={(e) => updatePersona(i, { description: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="row-actions" style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                setPersonas((prev) => [
                  ...prev,
                  {
                    id: `persona-${prev.length + 1}`,
                    name: `Persona ${prev.length + 1}`,
                    description: "",
                  },
                ])
              }
            >
              Add persona
            </button>
          </div>

          <h2 style={{ marginTop: "1.5rem" }}>Artifacts (2–5)</h2>
          <div className="list-block">
            {artifacts.map((a, i) => (
              <div className="item-card" key={a.draftKey}>
                <header>
                  <h3>{a.label || `Variant ${i + 1}`}</h3>
                  {artifacts.length > 2 ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setArtifacts((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      Remove
                    </button>
                  ) : null}
                </header>
                <div className="field">
                  <label>Label</label>
                  <input
                    value={a.label}
                    onChange={(e) => updateArtifact(i, { label: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Image URL (optional)</label>
                  <input
                    value={a.uploadImageUrl ?? ""}
                    onChange={(e) => updateArtifact(i, { uploadImageUrl: e.target.value })}
                    placeholder="https://…"
                  />
                </div>
                <div className="field">
                  <label>Summary</label>
                  <input
                    value={a.uploadSummary ?? ""}
                    onChange={(e) => updateArtifact(i, { uploadSummary: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Text / copy body</label>
                  <textarea
                    value={a.uploadText ?? ""}
                    onChange={(e) => updateArtifact(i, { uploadText: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="row-actions" style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={artifacts.length >= 5}
              onClick={() =>
                setArtifacts((prev) => {
                  const n = prev.length;
                  const letter = String.fromCharCode(65 + n);
                  return [
                    ...prev,
                    {
                      draftKey: `k-${Date.now()}`,
                      id: `variant-${letter.toLowerCase()}`,
                      label: `Variant ${letter}`,
                      uploadContentType: "text",
                      uploadSummary: "",
                      uploadText: "",
                    },
                  ];
                })
              }
            >
              Add artifact
            </button>
            <button type="button" className="btn" disabled={!canRun} onClick={() => void runTest()}>
              {running ? "Running…" : "Run A/B test"}
            </button>
          </div>

          {status ? (
            <div className="progress">
              <div className="muted">
                {status.stepName ?? status.status}
                {typeof status.percentage === "number" ? ` · ${status.percentage}%` : ""}
                {status.message ? ` — ${status.message}` : ""}
              </div>
              <div className="progress-bar" aria-hidden>
                <span style={{ width: `${status.percentage ?? 0}%` }} />
              </div>
            </div>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
        </section>

        <section className="panel">
          <h2>Results</h2>
          {!report && !running ? (
            <p className="muted">
              Run a test to see per-artifact feedback, each persona&apos;s best-aligned pick, and
              the overall winner.
            </p>
          ) : null}

          {report ? (
            <>
              <div className="winner-banner">
                <div className="muted">Overall winner</div>
                <h2>{report.overallWinner.variantLabel}</h2>
                <p style={{ margin: "0 0 0.5rem" }}>{report.overallWinner.rationale}</p>
                <p className="muted" style={{ margin: 0 }}>
                  {report.overallWinner.voteCount}/{report.overallWinner.totalPersonas} persona
                  {report.overallWinner.totalPersonas === 1 ? "" : "s"} chose this
                  {report.overallWinner.wasTie ? " · tie flagged" : ""}
                </p>
              </div>

              <p>{report.summary}</p>

              <h3 style={{ fontFamily: "var(--font-display)", marginTop: "1.25rem" }}>
                Artifact rollups
              </h3>
              <div className="feedback-grid">
                {report.artifactRollups.map((r) => (
                  <div
                    className={`item-card${r.variantId === report.overallWinner.variantId ? " is-best" : ""}`}
                    key={r.variantId}
                  >
                    <header>
                      <h3>{r.variantLabel}</h3>
                      {r.variantId === report.overallWinner.variantId ? (
                        <span className="chip strong">winner</span>
                      ) : null}
                    </header>
                    <div className="muted">
                      Chosen by:{" "}
                      {r.personasWhoChoseIt.length ? r.personasWhoChoseIt.join(", ") : "—"}
                    </div>
                    {r.commonStrengths.length ? (
                      <>
                        <div className="muted" style={{ marginTop: "0.5rem" }}>
                          Strengths
                        </div>
                        <ul className="compact">
                          {r.commonStrengths.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                    {r.commonConcerns.length ? (
                      <>
                        <div className="muted" style={{ marginTop: "0.5rem" }}>
                          Concerns
                        </div>
                        <ul className="compact">
                          {r.commonConcerns.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>

              {report.byPersona.map((p) => (
                <div className="persona-section" key={p.personaId}>
                  <h3>{p.personaName}</h3>
                  <p className="muted" style={{ marginTop: 0 }}>
                    Best aligned: <strong style={{ color: "var(--winner)" }}>{p.bestAlignedVariantLabel}</strong>
                    {" — "}
                    {p.whyBestAligned}
                  </p>
                  <div className="feedback-grid">
                    {p.artifactFeedback.map((f) => (
                      <div
                        className={`item-card${f.variantId === p.bestAlignedVariantId ? " is-best" : ""}`}
                        key={f.variantId}
                      >
                        <header>
                          <h3>{f.variantLabel}</h3>
                          <span className={strengthClass(f.alignmentStrength)}>
                            {f.alignmentStrength}
                          </span>
                        </header>
                        <p style={{ margin: "0 0 0.5rem" }}>{f.overallImpression}</p>
                        <div className="muted">Alignment</div>
                        <p style={{ margin: "0.15rem 0 0.5rem" }}>{f.alignmentNotes}</p>
                        {f.whatResonated.length ? (
                          <>
                            <div className="muted">Resonated</div>
                            <ul className="compact">
                              {f.whatResonated.map((x) => (
                                <li key={x}>{x}</li>
                              ))}
                            </ul>
                          </>
                        ) : null}
                        {f.whatMissed.length ? (
                          <>
                            <div className="muted" style={{ marginTop: "0.4rem" }}>
                              Missed
                            </div>
                            <ul className="compact">
                              {f.whatMissed.map((x) => (
                                <li key={x}>{x}</li>
                              ))}
                            </ul>
                          </>
                        ) : null}
                        {f.concreteSuggestion ? (
                          <p className="muted" style={{ marginTop: "0.55rem" }}>
                            Suggestion: {f.concreteSuggestion}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : running ? (
            <p className="muted">Collecting qualitative feedback from each persona…</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
