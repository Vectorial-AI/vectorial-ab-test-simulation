import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { abTestWorkflow } from "@/app/workflows/ab-test";
import { addCorsHeaders, handleOptions } from "@/lib/utils/cors";
import { ProgressStore } from "@/lib/utils/progress-store";
import { validateAbTestBody } from "@/lib/utils/validate";
import type { AbTestWorkflowInput, StartAbTestResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const response = NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    return addCorsHeaders(response, request);
  }

  const validated = validateAbTestBody(body);
  if (typeof validated === "string") {
    const response = NextResponse.json({ error: validated }, { status: 400 });
    return addCorsHeaders(response, request);
  }

  try {
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

    const payload: StartAbTestResponse = {
      status: "processing",
      runId: run.runId,
      message: "A/B test workflow started. Poll the statusUrl for updates.",
      statusUrl: `/api/ab-test/status/${run.runId}`,
    };

    const response = NextResponse.json(payload, { status: 202 });
    return addCorsHeaders(response, request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start workflow";
    const response = NextResponse.json({ error: message }, { status: 500 });
    return addCorsHeaders(response, request);
  }
}
