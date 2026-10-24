import { WorkflowRunFailedError } from "workflow/errors";

export type WorkflowClientStatus = "running" | "completed" | "failed";

export type WorkflowEnvelope = {
  status?: "completed" | "failed";
  result?: unknown;
  error?: string;
};

/**
 * Map a Vercel workflow run into the status payload the frontend polls.
 * Application-level `{ status: "failed" }` returns still mark the engine run as
 * completed, so the API must read the envelope — not only `run.status`.
 */
export function resolveWorkflowClientPayload(input: {
  runStatus: string;
  returnValue?: WorkflowEnvelope | null;
  thrownError?: unknown;
}): {
  status: WorkflowClientStatus;
  result: unknown;
  error: string | null;
} {
  if (input.runStatus === "completed") {
    if (input.returnValue?.status === "failed") {
      return {
        status: "failed",
        result: null,
        error: toClientWorkflowError(input.returnValue.error ?? "Workflow failed"),
      };
    }
    return {
      status: "completed",
      result: input.returnValue?.result ?? null,
      error: input.returnValue?.error ?? null,
    };
  }

  if (input.runStatus === "failed" || input.runStatus === "cancelled") {
    const fromReturn = input.returnValue?.error;
    const fromThrow = extractThrownErrorMessage(input.thrownError);
    const fallback =
      input.runStatus === "cancelled" ? "Workflow was cancelled" : "Workflow failed";
    return {
      status: "failed",
      result: null,
      error: toClientWorkflowError(fromReturn || fromThrow || fallback),
    };
  }

  return { status: "running", result: null, error: null };
}

export function toClientWorkflowError(message: string): string {
  const trimmed = message.trim();
  return trimmed || "Workflow failed";
}

function extractThrownErrorMessage(error: unknown): string | null {
  if (error == null) return null;
  if (WorkflowRunFailedError.is(error)) {
    return extractThrownErrorMessage(error.cause);
  }
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) return message;
    return extractThrownErrorMessage(error.cause);
  }
  if (typeof error === "string") {
    const message = error.trim();
    return message || null;
  }
  return null;
}
