import OpenAI from "openai";
import { Settings } from "@/lib/config/settings";
import { resolveImagesToDataUrls } from "@/lib/utils/image-data-url";

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };
type ContentPart = TextPart | ImagePart;

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
    /**
     * Remote image URLs (or data URLs). Remotes are fetched here and sent as
     * base64 so OpenAI does not need to download them itself.
     */
    imageUrls?: string[];
    /** Optional labels aligned with imageUrls (e.g. variant labels). */
    imageLabels?: string[];
    temperature?: number;
  }): Promise<string> {
    const content: ContentPart[] = [{ type: "text", text: input.userText }];

    const rawUrls = (input.imageUrls ?? []).map((u) => u.trim()).filter(Boolean);
    if (rawUrls.length > 0) {
      const dataUrls = await resolveImagesToDataUrls(rawUrls);
      for (let i = 0; i < dataUrls.length; i++) {
        const label = input.imageLabels?.[i]?.trim();
        if (label) {
          content.push({ type: "text", text: `Attached image for: ${label}` });
        }
        content.push({
          type: "image_url",
          image_url: { url: dataUrls[i], detail: "auto" },
        });
      }
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: input.temperature ?? 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.system },
        { role: "user", content },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error("OpenAI returned an empty completion");
    }
    return text;
  }
}
