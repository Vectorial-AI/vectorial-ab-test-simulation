import OpenAI from "openai";
import { Settings } from "@/lib/config/settings";

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
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
    imageUrls?: string[];
    temperature?: number;
  }): Promise<string> {
    const content: ContentPart[] = [{ type: "text", text: input.userText }];
    for (const url of input.imageUrls ?? []) {
      if (url.trim()) {
        content.push({ type: "image_url", image_url: { url: url.trim() } });
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
