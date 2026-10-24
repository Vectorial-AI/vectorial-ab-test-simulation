export interface AppSettings {
  openaiApiKey: string;
  openaiModel: string;
}

export class Settings {
  private static instance: Settings | null = null;
  private readonly config: AppSettings;

  private constructor() {
    this.config = {
      openaiApiKey: Settings.requireEnv("OPENAI_API_KEY"),
      openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o",
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

  /**
   * Enterprise-specific direct database URL.
   * Example: enterpriseName "beta" -> BETA_DIRECT_DATABASE_URL
   */
  getEnterpriseDirectDbUrl(enterpriseName: string): string {
    const sanitized = enterpriseName
      .trim()
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toUpperCase();
    const envKey = `${sanitized}_DIRECT_DATABASE_URL`;
    return Settings.requireEnv(envKey);
  }

  private static requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  }
}
