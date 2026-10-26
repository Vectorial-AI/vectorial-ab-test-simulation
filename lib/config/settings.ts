export interface AppSettings {
  openaiApiKey: string;
  openaiModel: string;
  chatAgentServiceEmail: string;
  chatAgentServicePassword: string;
  chatAgentAuthUrl: string;
  chatAgentApiUrl: string;
  chatAgentStageApiUrl: string;
  chatAgentProductId: string;
  chatAgentEnterpriseName: string;
  chatAgentUserId: string;
  chatAgentReasoningMode: boolean;
  chatAgentIsWebSearch: boolean;
  chatAgentSourceFilter: string[];
}

export class Settings {
  private static instance: Settings | null = null;
  private readonly config: AppSettings;

  private constructor() {
    const sourceFilterRaw = process.env.CHAT_AGENT_SOURCE_FILTER ?? "";
    const sourceFilter = sourceFilterRaw
      ? sourceFilterRaw.split(",").map((s) => s.trim())
      : ["Slack", "Salesforce", "Coda", "Dialpad", "Google Drive", "Manual_Upload", "socials"];

    this.config = {
      openaiApiKey: Settings.requireEnv("OPENAI_API_KEY"),
      openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o",
      chatAgentServiceEmail: Settings.requireEnv("CHAT_AGENT_SERVICE_EMAIL"),
      chatAgentServicePassword: Settings.requireEnv("CHAT_AGENT_SERVICE_PASSWORD"),
      chatAgentAuthUrl:
        process.env.CHAT_AGENT_AUTH_URL ?? "https://auth-api.vectorialapi.com/api/auth/login",
      chatAgentApiUrl:
        process.env.CHAT_AGENT_API_URL ?? "https://chat-api.vectorialapi.com/agent/langgraphV3/",
      chatAgentStageApiUrl:
        process.env.CHAT_AGENT_STAGE_API ?? "https://chat-api.vectorialapi.com/agent/langgraphV3/",
      chatAgentProductId:
        process.env.CHAT_AGENT_PRODUCT_ID ?? "3d443c79-fb7c-45b0-977d-ac1901960711",
      chatAgentEnterpriseName: process.env.CHAT_AGENT_ENTERPRISE_NAME ?? "beta",
      chatAgentUserId:
        process.env.CHAT_AGENT_USER_ID ?? "608043e6-5046-4ee5-88d3-0ef0fca8cedc",
      chatAgentReasoningMode: process.env.CHAT_AGENT_REASONING_MODE !== "false",
      chatAgentIsWebSearch: process.env.CHAT_AGENT_IS_WEB_SEARCH === "true",
      chatAgentSourceFilter: sourceFilter,
    };
  }

  static getInstance(): Settings {
    if (!Settings.instance) {
      Settings.instance = new Settings();
    }
    return Settings.instance;
  }

  getAll(): AppSettings {
    return this.config;
  }

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.config[key];
  }

  static isBetaEnterprise(enterpriseName: string): boolean {
    return enterpriseName.trim().toLowerCase() === "beta";
  }

  /** Same split as social-wall-posts: beta → stage URL, everyone else → prod. */
  getChatAgentApiUrl(enterpriseName: string): string {
    return Settings.isBetaEnterprise(enterpriseName)
      ? this.config.chatAgentStageApiUrl
      : this.config.chatAgentApiUrl;
  }

  getEnterpriseDirectDbUrl(enterpriseName: string): string {
    const sanitized = enterpriseName
      .trim()
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toUpperCase();
    return Settings.requireEnv(`${sanitized}_DIRECT_DATABASE_URL`);
  }

  private static requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  }
}
