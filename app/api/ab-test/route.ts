import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { abTestWorkflow } from "@/app/workflows/ab-test";
import { ProgressStore } from "@/lib/utils/progress-store";
import { validateAbTestBody } from "@/lib/utils/validate";
import type { AbTestWorkflowInput, StartAbTestResponse } from "@/lib/types";

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

  const trackingId = randomUUID();
  const progressStore = ProgressStore.getInstance();

  await progressStore.setProgress(trackingId, {
    runId: trackingId,
    currentStep: 0,
    stepName: "initializing",
    totalSteps: 3,
    percentage: 0,
    message: "A/B test queued",
  });

  const input: AbTestWorkflowInput = {
    ...validated,
    runId: trackingId,
  };

  const run = await start(abTestWorkflow, [input]);
  await progressStore.setAlias(run.runId, trackingId);

  const response: StartAbTestResponse = {
    status: "processing",
    runId: run.runId,
    message: "A/B test workflow started. Poll the statusUrl for updates.",
    statusUrl: `/api/ab-test/status/${run.runId}`,
  };

  return NextResponse.json(response, { status: 202 });
}
