import { NextRequest, NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { addCorsHeaders, handleOptions } from "@/lib/utils/cors";
import { ProgressStore } from "@/lib/utils/progress-store";
import { resolveWorkflowClientPayload } from "@/lib/utils/workflow-run-error";
import type { AbTestWorkflowOutput } from "@/lib/types";

export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  try {
    const run = getRun(runId);
    const status = await run.status;
    const progressStore = ProgressStore.getInstance();
    const progress = await progressStore.getProgress(runId);

    if (status === "completed" || status === "failed" || status === "cancelled") {
      let returnValue: AbTestWorkflowOutput | undefined;
      let thrownError: unknown;
      try {
        returnValue = (await run.returnValue) as AbTestWorkflowOutput | undefined;
      } catch (error) {
        thrownError = error;
      }

      await progressStore.deleteProgress(runId);

      const payload = resolveWorkflowClientPayload({
        runStatus: status,
        returnValue,
        thrownError,
      });

      const response = NextResponse.json({
        runId,
        status: payload.status,
        result: payload.result ?? null,
        error: payload.error,
        progress,
      });
      return addCorsHeaders(response, request);
    }

    const response = NextResponse.json({
      runId,
      status: "running",
      progress,
      result: null,
      error: null,
    });
    return addCorsHeaders(response, request);
  } catch {
    const response = NextResponse.json(
      { error: "Workflow run not found", runId },
      { status: 404 }
    );
    return addCorsHeaders(response, request);
  }
}
