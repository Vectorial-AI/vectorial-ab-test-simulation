/**
 * Step: Update Progress
 *
 * Persists progress that the status endpoint polls.
 * trackingId is generated in the API route BEFORE start(), then passed into the workflow.
 */

import { ProgressStore } from "@/lib/utils/progress-store";
import type { WorkflowProgress } from "@/lib/utils/progress-store";

export async function updateProgress(
  trackingId: string,
  progress: Partial<WorkflowProgress>
): Promise<void> {
  "use step";

  if (!trackingId || typeof trackingId !== "string" || trackingId.trim() === "") {
    console.warn("⚠️ updateProgress: No trackingId provided, skipping update");
    return;
  }

  const store = ProgressStore.getInstance();
  await store.setProgress(trackingId, {
    ...progress,
    runId: trackingId,
  });
}
