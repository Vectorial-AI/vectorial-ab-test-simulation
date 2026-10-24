import { NextResponse } from "next/server";
import { getProgress } from "@/lib/utils/progress-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> }
) {
  const { runId } = await context.params;
  const state = getProgress(runId);

  if (!state) {
    return NextResponse.json({ error: "Run not found", runId }, { status: 404 });
  }

  return NextResponse.json({
    status: state.status,
    runId: state.runId,
    currentStep: state.currentStep,
    totalSteps: state.totalSteps,
    stepName: state.stepName,
    percentage: state.percentage,
    message: state.message,
    error: state.error,
    result: state.status === "completed" ? state.result : undefined,
  });
}
