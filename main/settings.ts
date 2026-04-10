import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expiry_date?: number;
  scope?: string;
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
}

interface AppSettings {
  claudeApiKey?: string;
  googleCredentialsPath?: string;
  googleOAuthTokens?: GoogleOAuthTokens;
  googleOAuthConfig?: GoogleOAuthConfig;
  userPreferences?: string;
  lastSyncDate?: string;
  googleDriveSpreadsheetId?: string;
  instacartApiKey?: string;
}

class SettingsManager {
  private get settingsPath(): string {
    return path.join(app.getPath('userData'), 'settings.json');
  }

  private read(): AppSettings {
    try {
      if (!fs.existsSync(this.settingsPath)) return {};
      return JSON.parse(fs.readFileSync(this.settingsPath, 'utf-8'));
    } catch {
      return {};
    }
  }

  private write(settings: AppSettings): void {
    fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  private get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.read()[key];
  }

  private set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    const settings = this.read();
    settings[key] = value;
    this.write(settings);
  }

  async getClaudeApiKey(): Promise<string | undefined> {
    return this.get('claudeApiKey');
  }

  async setClaudeApiKey(key: string): Promise<void> {
    this.set('claudeApiKey', key);
  }

  async hasClaudeApiKey(): Promise<boolean> {
    return !!this.get('claudeApiKey');
  }

  async getUserPreferences(): Promise<string | undefined> {
    return this.get('userPreferences');
  }

  async setUserPreferences(prefs: string): Promise<void> {
    this.set('userPreferences', prefs);
  }

  async getLastSyncDate(): Promise<string | undefined> {
    return this.get('lastSyncDate');
  }

  async setLastSyncDate(date: string): Promise<void> {
    this.set('lastSyncDate', date);
  }

  async getGoogleCredentialsPath(): Promise<string | undefined> {
    return this.get('googleCredentialsPath');
  }

  async setGoogleCredentialsPath(p: string): Promise<void> {
    this.set('googleCredentialsPath', p);
  }

  async getGoogleOAuthTokens(): Promise<GoogleOAuthTokens | undefined> {
    return this.get('googleOAuthTokens');
  }

  async setGoogleOAuthTokens(tokens: GoogleOAuthTokens): Promise<void> {
    this.set('googleOAuthTokens', tokens);
  }

  async hasGoogleOAuthTokens(): Promise<boolean> {
    const tokens = this.get('googleOAuthTokens');
    return !!(tokens && tokens.access_token && tokens.access_token !== 'PLACEHOLDER');
  }

  async getGoogleOAuthConfig(): Promise<GoogleOAuthConfig | undefined> {
    return this.get('googleOAuthConfig');
  }

  async setGoogleOAuthConfig(config: GoogleOAuthConfig): Promise<void> {
    this.set('googleOAuthConfig', config);
  }

  async getGoogleDriveSpreadsheetId(): Promise<string | undefined> {
    return this.get('googleDriveSpreadsheetId');
  }

  async setGoogleDriveSpreadsheetId(id: string): Promise<void> {
    this.set('googleDriveSpreadsheetId', id);
  }

  async getInstacartApiKey(): Promise<string | undefined> {
    return this.get('instacartApiKey');
  }

  async setInstacartApiKey(key: string): Promise<void> {
    this.set('instacartApiKey', key);
  }

  async hasInstacartApiKey(): Promise<boolean> {
    return !!this.get('instacartApiKey');
  }

  async clear(): Promise<void> {
    this.write({});
  }

  async getAll(): Promise<AppSettings> {
    return this.read();
  }
}

export const settingsManager = new SettingsManager();
