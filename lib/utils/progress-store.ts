import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { ProgressState } from "@/lib/types";

/**
 * File-backed progress store so status polling works across Next.js workers
 * and survives the POST request finishing.
 */
const DIR = join(process.cwd(), ".ab-runs");

function ensureDir(): void {
  if (!existsSync(DIR)) {
    mkdirSync(DIR, { recursive: true });
  }
}

function pathFor(runId: string): string {
  const safe = runId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(DIR, `${safe}.json`);
}

export function saveProgress(state: ProgressState): void {
  ensureDir();
  const next = { ...state, updatedAt: new Date().toISOString() };
  writeFileSync(pathFor(state.runId), JSON.stringify(next), "utf8");
}

export function getProgress(runId: string): ProgressState | undefined {
  const file = pathFor(runId);
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as ProgressState;
  } catch {
    return undefined;
  }
}

export function patchProgress(
  runId: string,
  patch: Partial<Omit<ProgressState, "runId" | "createdAt">>
): ProgressState | undefined {
  const existing = getProgress(runId);
  if (!existing) return undefined;
  const next: ProgressState = {
    ...existing,
    ...patch,
    runId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  saveProgress(next);
  return next;
}
