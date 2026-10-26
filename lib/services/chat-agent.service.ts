/**
 * LangGraph V3 chat-agent client — same contract as
 * vectorial-social-wall-posts SocialWallChatAgentService.callPersonaAgent.
 *
 * Persona eval uses prompt_definition "creative_test_prompt" + audienceroom_id.
 * We only ask for qualitative JSON (no hook_rate / click_intent).
 */

import { v4 as uuidv4 } from "uuid";
import { Settings } from "@/lib/config/settings";

interface AuthResponse {
  token?: string;
}

export interface ChatAgentPersonaInput {
  roomId: string;
  roomName: string;
  enterpriseName: string;
  humanInput: string;
  systemInput: string;
  retrievalQuery?: string;
  tribeId?: string;
}

export interface ChatAgentPersonaOutput {
  roomId: string;
  roomName: string;
  responseText: string;
}

export class ChatAgentService {
  private readonly settings = Settings.getInstance();

  async getAuthToken(): Promise<string> {
    const response = await fetch(this.settings.get("chatAgentAuthUrl"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: this.settings.get("chatAgentServiceEmail"),
        password: this.settings.get("chatAgentServicePassword"),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Chat-agent authentication failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as AuthResponse;
    if (!data.token) {
      throw new Error("Chat-agent authentication returned no token");
    }
    return data.token;
  }

  private parseModelJson(responseText: string): unknown {
    let text = responseText.trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      text = fenced[1].trim();
    } else {
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    }
    return JSON.parse(text);
  }

  private normalizeQualitativePersonaResponse(responseText: string): string {
    const parsed = this.parseModelJson(responseText) as {
      artifact_feedback?: unknown;
      best_aligned_variant_id?: unknown;
    };

    if (!Array.isArray(parsed.artifact_feedback) || parsed.artifact_feedback.length < 1) {
      throw new Error("Persona evaluation missing artifact_feedback");
    }
    if (typeof parsed.best_aligned_variant_id !== "string" || !parsed.best_aligned_variant_id.trim()) {
      throw new Error("Persona evaluation missing best_aligned_variant_id");
    }

    return JSON.stringify(parsed);
  }

  async callPersonaAgent(input: ChatAgentPersonaInput): Promise<ChatAgentPersonaOutput> {
    const jwtToken = await this.getAuthToken();
    const retrievalQuery = input.retrievalQuery?.trim();

    const payload = {
      product_id: this.settings.get("chatAgentProductId"),
      thread_id: uuidv4(),
      human_input: input.humanInput,
      ...(retrievalQuery ? { retrieval_query: retrievalQuery } : {}),
      system_input: input.systemInput,
      product_story: null,
      enterprise_name: this.settings.get("chatAgentEnterpriseName"),
      user_id: this.settings.get("chatAgentUserId"),
      reasoningMode: false,
      source_filter: this.settings.get("chatAgentSourceFilter"),
      is_web_search: this.settings.get("chatAgentIsWebSearch"),
      audienceroom_id: input.roomId,
      ...(input.tribeId ? { audiencetribe_id: input.tribeId } : {}),
      clone_id: null,
      clone_profile_ids: null,
      prompt_definition: "creative_test_prompt",
    };

    const response = await fetch(this.settings.getChatAgentApiUrl(input.enterpriseName), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(600_000),
    });

    if (!response.ok) {
      throw new Error(`Chat-agent call failed: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as Record<string, unknown>;
    const responseText =
      typeof result.response === "string"
        ? result.response
        : typeof result.Response === "string"
          ? result.Response
          : typeof result.message === "string"
            ? result.message
            : typeof result.content === "string"
              ? result.content
              : "";

    if (!responseText) {
      throw new Error("Chat-agent returned empty response");
    }

    return {
      roomId: input.roomId,
      roomName: input.roomName,
      responseText: this.normalizeQualitativePersonaResponse(responseText),
    };
  }
}
