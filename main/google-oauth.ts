import { google, Auth } from 'googleapis';
import http from 'http';
import express, { Request, Response } from 'express';
import url from 'url';
import { BrowserWindow } from 'electron';

interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expiry_date?: number;
  scope?: string;
}

export class GoogleOAuthHandler {
  private config: GoogleOAuthConfig;
  private oauth2Client: Auth.OAuth2Client;
  private localServer: http.Server | null = null;

  constructor(config: GoogleOAuthConfig) {
    this.config = config;
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
  }

  /**
   * Start the OAuth flow by opening browser and waiting for callback
   */
  async startAuthFlow(_mainWindow: BrowserWindow | null = null): Promise<GoogleTokens> {
    const PORT = 49152;
    const redirectUri = `http://localhost:${PORT}/oauth2callback`;

    // Recreate client with the exact redirect URI we'll use
    this.oauth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      redirectUri
    );

    return new Promise((resolve, reject) => {
      const server = express();
      this.localServer = http.createServer(server);

      server.get('/oauth2callback', async (req: Request, res: Response) => {
        const code = req.query.code as string;
        const error = req.query.error as string;

        if (error) {
          res.send(`<h1>Authorization Error</h1><p>${error}</p><p>You can close this window.</p>`);
          this.localServer?.close();
          reject(new Error(`Google OAuth error: ${error}`));
          return;
        }

        if (!code) {
          res.send('<h1>Error</h1><p>No authorization code received.</p>');
          this.localServer?.close();
          reject(new Error('No authorization code received'));
          return;
        }

        res.send('<h1>Authorization Successful!</h1><p>You can close this window and return to Meal Prep Planner.</p>');

        try {
          const { tokens } = await this.oauth2Client.getToken(code);
          this.localServer?.close();
          resolve(tokens as GoogleTokens);
        } catch (err) {
          this.localServer?.close();
          reject(err);
        }
      });

      this.localServer.listen(PORT, 'localhost', () => {
        const authUrl = this.oauth2Client.generateAuthUrl({
          access_type: 'offline',
          prompt: 'consent',
          scope: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive',
          ],
        });

        console.log(`Opening browser for Google OAuth...`);
        const { shell } = require('electron');
        shell.openExternal(authUrl);
      });

      this.localServer.on('error', (err: NodeJS.ErrnoException) => {
        reject(new Error(`Could not start OAuth callback server on port ${PORT}: ${err.message}`));
      });
    });
  }

  /**
   * Refresh an access token using a refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const { credentials } = await this.oauth2Client.refreshAccessToken();
    return credentials as GoogleTokens;
  }

  /**
   * Get a fresh access token (uses cached or refresh token)
   */
  async getAccessToken(tokens: GoogleTokens): Promise<string> {
    this.oauth2Client.setCredentials(tokens);

    // Check if token is expired
    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      console.log('Access token expired, refreshing...');
      if (!tokens.refresh_token) {
        throw new Error('Refresh token not available. Please re-authenticate.');
      }
      const refreshed = await this.refreshAccessToken(tokens.refresh_token);
      return refreshed.access_token;
    }

    return tokens.access_token;
  }

  /**
   * Get OAuth2 client with credentials set
   */
  getOAuth2Client(tokens: GoogleTokens): Auth.OAuth2Client {
    this.oauth2Client.setCredentials(tokens);
    return this.oauth2Client;
  }
}
