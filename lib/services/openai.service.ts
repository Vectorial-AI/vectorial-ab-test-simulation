import OpenAI from "openai";
import { Settings } from "@/lib/config/settings";

/**
 * Text-only OpenAI helper for the overall qualitative summary.
 * Persona evaluation goes through the LangGraph chat agent — not this client.
 */
export class OpenAIService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    const settings = Settings.getInstance();
    this.client = new OpenAI({ apiKey: settings.get("openaiApiKey") });
    this.model = settings.get("openaiModel");
  }

  async completeJson(input: {
    system: string;
    userText: string;
    temperature?: number;
  }): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: input.temperature ?? 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.userText },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error("OpenAI returned an empty completion");
    }
    return text;
  }
}
