import { after, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { validateAbTestBody } from "@/lib/utils/validate";
import { saveProgress } from "@/lib/utils/progress-store";
import { runAbTestWorkflow } from "@/lib/workflows/ab-test";
import type { ProgressState, StartAbTestResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validated = validateAbTestBody(body);
  if (typeof validated === "string") {
    return NextResponse.json({ error: validated }, { status: 400 });
  }

  const runId = `ab_${uuidv4()}`;
  const now = new Date().toISOString();
  const initial: ProgressState = {
    runId,
    status: "queued",
    currentStep: 0,
    totalSteps: 3,
    stepName: "queued",
    percentage: 0,
    message: "A/B test queued",
    input: validated,
    createdAt: now,
    updatedAt: now,
  };
  saveProgress(initial);

  // Continue after the HTTP response so polling can observe progress.
  after(async () => {
    try {
      await runAbTestWorkflow(runId, validated);
    } catch (err) {
      console.error(`[ab-test ${runId}]`, err);
    }
  });

  const response: StartAbTestResponse = {
    status: "processing",
    runId,
    message: "A/B test pipeline started. Poll the statusUrl for updates.",
    statusUrl: `/api/ab-test/status/${runId}`,
  };

  return NextResponse.json(response, { status: 202 });
}
