# Frontend handoff — Qualitative A/B Test Simulation

**Prod base URL:** `https://vectorial-ab-test-simulation.vercel.app`

Async Vercel Workflow API. Same start → poll pattern as `vectorial-social-wall-posts`, but **qualitative-only** results (no hook rate, click intent, preference polls, or social-wall comments).

---

## Overview

| Step | Method | Path |
|------|--------|------|
| Start run | `POST` | `/api/ab-test` |
| Poll status | `GET` | `/api/ab-test/status/{runId}` |

1. `POST` with tenant + personas + 2–5 artifacts → **202** + `runId` + `testId` + `statusUrl`
2. Poll `statusUrl` every **1–2s** until `status` is `completed` or `failed`
3. On `completed`, read `result` (`AbTestReport`). The report is also persisted in Postgres.

`statusUrl` is a **relative** path. Prefixed with the base URL:

```ts
const BASE = "https://vectorial-ab-test-simulation.vercel.app";
const start = await fetch(`${BASE}/api/ab-test`, { ... });
const { statusUrl, runId, testId } = await start.json();
// poll: `${BASE}${statusUrl}`  OR  `${BASE}/api/ab-test/status/${runId}`
// persist key: testId === QualitativeAbTest.id === result.id
```

---

## Persistence (important)

Completed runs are saved to a **dedicated** table:

| | |
|--|--|
| Table | **`QualitativeAbTest`** |
| Tenant DB | `{enterpriseName}_DIRECT_DATABASE_URL` (e.g. `beta` → `BETA_DIRECT_DATABASE_URL`) |
| Primary key | `testId` / `result.id` (server-generated UUID, **not** the Vercel `runId`) |

This is **not** `SocialWallPost`. Do not read/write social-wall tables for this product.

---

## CORS

Browser origins allowed (same allowlist as social-wall):

- `http://localhost:3000` and `http://*.localhost:3000`
- `https://*.runvectorial.com` (and apex)

Preflight: `OPTIONS` on both routes.  
Calls from other origins must go through your backend proxy.

> **Note:** CORS helpers are in the repo. If prod still rejects browser preflights, confirm the latest commit with CORS is deployed.

---

## Deployment protection (important)

As of handoff, unauthenticated requests to prod can return **HTTP 403** (Vercel Deployment Protection / SSO).

For FE integration you need one of:

- Turn off Deployment Protection on this Vercel project, **or**
- Use a protection bypass / shareable link for staging, **or**
- Call the API from a server that holds the bypass token (not the browser)

Confirm with whoever owns the Vercel project before wiring the UI.

---

## `POST /api/ab-test`

### Request

```http
POST /api/ab-test
Content-Type: application/json
```

```json
{
  "enterpriseName": "beta",
  "userId": "608043e6-5046-4ee5-88d3-0ef0fca8cedc",
  "userEmail": "you@company.com",
  "displayText": "Which creative should we use for the launch announcement?",
  "backgroundQuery": "Compare these creatives for each persona. Be concrete and qualitative — no scores.",
  "creativeEvaluation": {
    "campaignGoal": "Drive trial signups",
    "platform": "LinkedIn",
    "funnelStage": "awareness"
  },
  "historicalContext": "Optional prior learnings string",
  "additionalKnownSignals": "Optional extra context string",
  "personas": [
    {
      "id": "p1",
      "name": "Maya Chen",
      "description": "Design lead at a Series B SaaS company"
    }
  ],
  "artifacts": [
    {
      "id": "variant-a",
      "label": "Variant A",
      "uploadContentType": "text",
      "uploadSummary": "Short summary of the creative",
      "uploadText": "Headline + body copy…",
      "uploadImageUrl": "https://cdn.example.com/a.png"
    },
    {
      "id": "variant-b",
      "label": "Variant B",
      "uploadContentType": "image",
      "uploadImageUrl": "https://cdn.example.com/b.png",
      "uploadSummary": "Optional caption / OCR summary"
    }
  ]
}
```

### Field rules

| Field | Required | Notes |
|-------|----------|--------|
| `enterpriseName` | ✅ | Tenant slug (`beta`, etc.) — selects `{ENTERPRISE}_DIRECT_DATABASE_URL` |
| `userId` | ✅ | Acting user id |
| `userEmail` | ✅ | Acting user email |
| `displayText` | ✅ | Non-empty string — user-facing question / prompt |
| `backgroundQuery` | ✅ | Non-empty string — evaluation instructions |
| `personas` | ✅ | ≥ 1. Each needs `name`. `id` defaults to `persona-N` if omitted. `description` optional |
| `artifacts` **or** `uploadArtifacts` | ✅ | **2–5** items (social-wall alias `uploadArtifacts` accepted) |
| Per artifact content | ✅ | At least one of `uploadImageUrl`, `uploadText`, `uploadSummary` (aliases: `imageUrl`, `text`, `summary`). **Image URLs must be reachable from the Vercel workflow** (public https or a signed URL that has not expired). The server downloads them and sends base64 to OpenAI — OpenAI never fetches your CDN directly. |
| `uploadContentType` | ❌ | `"image" \| "video" \| "text" \| "pdf" \| "landing_page"` |
| `creativeEvaluation` | ❌ | `{ campaignGoal?, platform?, funnelStage? }` |
| `historicalContext` | ❌ | Free text |
| `additionalKnownSignals` | ❌ | Free text |

Do **not** send `runId` / `testId` — the server assigns them.

### Success — `202 Accepted`

```json
{
  "status": "processing",
  "runId": "wrun_xxxxxxxx",
  "testId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "message": "A/B test workflow started. Poll the statusUrl for updates.",
  "statusUrl": "/api/ab-test/status/wrun_xxxxxxxx"
}
```

- **`runId`** — Vercel workflow run id → use for status polling  
- **`testId`** — `QualitativeAbTest.id` / `result.id` → stable DB key after completion

### Errors — `400` / `500`

```json
{ "error": "A/B test requires 2–5 artifacts (got 1)" }
```

---

## `GET /api/ab-test/status/{runId}`

### While running — `200`

```json
{
  "runId": "wrun_xxxxxxxx",
  "status": "running",
  "progress": {
    "runId": "<tracking-id>",
    "currentStep": 1,
    "stepName": "evaluate_personas",
    "totalSteps": 3,
    "percentage": 40,
    "message": "Persona 1/2: Maya Chen",
    "lastUpdate": "2026-10-24T02:00:00.000Z"
  },
  "result": null,
  "error": null
}
```

### Progress UI

Read progress from **`progress`**, not the top level:

| Field | Use |
|-------|-----|
| `progress.percentage` | 0–100 bar |
| `progress.stepName` | Short label |
| `progress.message` | Human status line |
| `progress.currentStep` / `totalSteps` | Step counter (3 steps total) |

Typical `stepName` values: `initializing` → `evaluate_personas` → `generate_summary` → `store_result` → `completed` / `failed`.

### Completed — `200`

```json
{
  "runId": "wrun_xxxxxxxx",
  "status": "completed",
  "result": { /* AbTestReport — see below */ },
  "error": null,
  "progress": { /* last snapshot; may be null after cleanup */ }
}
```

### Failed — `200` (application failure) or engine failure

```json
{
  "runId": "wrun_xxxxxxxx",
  "status": "failed",
  "result": null,
  "error": "OpenAI returned an empty completion",
  "progress": { ... }
}
```

Treat **`status === "failed"`** (and/or non-null `error` with failed status) as a hard stop. Do not keep polling.

### Not found — `404`

```json
{ "error": "Workflow run not found", "runId": "..." }
```

---

## Result shape — `AbTestReport`

Qualitative. **No** `hookRate`, `clickIntent`, poll percentages, or social comments.

```ts
type AlignmentStrength = "strong" | "moderate" | "weak" | "misaligned";

interface AbTestReport {
  id: string; // same as testId / QualitativeAbTest.id
  summary: string;
  byPersona: PersonaAbResult[];
  overallWinner: OverallWinner;
  artifactRollups: Array<{
    variantId: string;
    variantLabel: string;
    personasWhoChoseIt: string[]; // persona names
    commonStrengths: string[];
    commonConcerns: string[];
  }>;
}

interface PersonaAbResult {
  personaId: string;
  personaName: string;
  artifactFeedback: ArtifactFeedback[];
  bestAlignedVariantId: string;
  bestAlignedVariantLabel: string;
  whyBestAligned: string;
}

interface ArtifactFeedback {
  variantId: string;
  variantLabel: string;
  overallImpression: string;
  whatResonated: string[];
  whatMissed: string[];
  alignmentNotes: string;
  alignmentStrength: AlignmentStrength;
  concreteSuggestion: string;
}

interface OverallWinner {
  variantId: string;
  variantLabel: string;
  voteCount: number;
  totalPersonas: number;
  rationale: string;
  personaVotes: Array<{
    personaId: string;
    personaName: string;
    choseVariantId: string;
    choseVariantLabel: string;
  }>;
  wasTie: boolean;
  runnerUp?: {
    variantId: string;
    variantLabel: string;
    voteCount: number;
  };
}
```

### Suggested UI sections

1. **Summary** — `result.summary`
2. **Overall winner** — `result.overallWinner` (show `wasTie` + `runnerUp` when present)
3. **Per persona** — for each `byPersona[]`: pick + `whyBestAligned`, then cards for each `artifactFeedback[]` (impression, resonated, missed, alignment chip, suggestion)
4. **Artifact rollups** — `artifactRollups[]` strengths / concerns across personas

Alignment chips: `strong` | `moderate` | `weak` | `misaligned` (not numeric scores).

---

## Minimal client (TypeScript)

```ts
const BASE = "https://vectorial-ab-test-simulation.vercel.app";

export async function runQualitativeAbTest(body: unknown) {
  const startRes = await fetch(`${BASE}/api/ab-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const start = await startRes.json();
  if (!startRes.ok) {
    throw new Error(start.error ?? `Start failed (${startRes.status})`);
  }

  const statusUrl = `${BASE}${start.statusUrl as string}`;

  for (;;) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(statusUrl);
    const data = await pollRes.json();
    if (!pollRes.ok) {
      throw new Error(data.error ?? `Status failed (${pollRes.status})`);
    }

    // drive progress UI from data.progress
    if (data.status === "completed") {
      if (!data.result) throw new Error("Completed with empty result");
      return data.result;
    }
    if (data.status === "failed") {
      throw new Error(data.error ?? "A/B test failed");
    }
  }
}
```

---

## Timing & limits

| Item | Value |
|------|--------|
| Poll interval | 1–2s recommended |
| Server `maxDuration` | 300s |
| Typical run | scales with `#personas` (1 OpenAI call each) + 1 summary call |
| Artifacts | 2–5 |
| Personas | ≥ 1 (keep reasonable; each is a durable step) |

---

## Diff vs social-wall creative A/B

| | Social-wall creative A/B | This service |
|--|--------------------------|--------------|
| Start/poll | `POST /api/social-wall-posts` + status | `POST /api/ab-test` + status |
| Orchestration | Vercel Workflow | Vercel Workflow (same pattern) |
| Quantitative polls | Yes (preference / etc.) | **No** |
| Hook rate / click intent | Yes (where applicable) | **No** |
| Social-wall comments | Yes | **No** |
| Result focus | Creative test report + wall | Qualitative alignment + winner votes |

Reuse the same async UX pattern; swap the result renderer for the qualitative `AbTestReport`.

---

## Smoke checklist for FE

- [ ] Prod reachable (not stuck on Vercel **403** protection)
- [ ] CORS OK from `localhost:3000` / `*.runvectorial.com`
- [ ] `POST` with 2 artifacts + 1 persona → `202` + `runId`
- [ ] Poll until `completed`; progress bar moves via `progress.percentage`
- [ ] Render `summary`, `overallWinner`, `byPersona`, `artifactRollups`
- [ ] Handle `failed` + `400` validation errors

Questions / contract changes: backend owner of `vectorial-ab-test-simulation`.
