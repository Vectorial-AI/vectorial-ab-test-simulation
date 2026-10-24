/**
 * Progress Store (Redis)
 *
 * Persists intermediate progress across serverless / workflow step invocations.
 *
 * Alias map bridges Vercel's workflow runId (known after start()) with our
 * self-generated trackingId (known before start() and passed into the workflow).
 *
 * Keys: "progress:{trackingId}" and "alias:{vercelRunId}"
 * TTL: 1 hour
 */

import { createClient } from "redis";

export interface WorkflowProgress {
  runId: string;
  currentStep: number;
  stepName: string;
  totalSteps: number;
  percentage: number;
  message?: string;
  lastUpdate: string;
}

let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedisClient() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL environment variable is not set");
    }

    redisClient = createClient({ url: redisUrl });
    redisClient.on("error", (err) => {
      console.error("Redis Client Error:", err);
    });
    await redisClient.connect();
  }

  return redisClient;
}

export class ProgressStore {
  private constructor() {}

  static getInstance(): ProgressStore {
    return new ProgressStore();
  }

  async setProgress(trackingId: string, progress: Partial<WorkflowProgress>): Promise<void> {
    const client = await getRedisClient();
    const key = `progress:${trackingId}`;

    const existingJson = await client.get(key);
    const existing: WorkflowProgress | null = existingJson ? JSON.parse(existingJson) : null;

    const updated: WorkflowProgress = {
      runId: trackingId,
      currentStep: 0,
      stepName: "initializing",
      totalSteps: 3,
      percentage: 0,
      lastUpdate: new Date().toISOString(),
      ...existing,
      ...progress,
    };

    await client.setEx(key, 3600, JSON.stringify(updated));
  }

  async setAlias(vercelRunId: string, trackingId: string): Promise<void> {
    const client = await getRedisClient();
    await client.setEx(`alias:${vercelRunId}`, 3600, trackingId);
  }

  async getProgress(id: string): Promise<WorkflowProgress | null> {
    const client = await getRedisClient();

    const directJson = await client.get(`progress:${id}`);
    if (directJson) {
      return JSON.parse(directJson) as WorkflowProgress;
    }

    const trackingId = await client.get(`alias:${id}`);
    if (trackingId) {
      const progressJson = await client.get(`progress:${trackingId}`);
      if (progressJson) {
        return JSON.parse(progressJson) as WorkflowProgress;
      }
    }

    return null;
  }

  async deleteProgress(id: string): Promise<void> {
    const client = await getRedisClient();
    await client.del(`progress:${id}`);

    const aliasKey = `alias:${id}`;
    const trackingId = await client.get(aliasKey);
    if (trackingId) {
      await client.del(`progress:${trackingId}`);
      await client.del(aliasKey);
    }
  }
}
