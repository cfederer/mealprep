import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { GoogleDriveStore, GoogleDriveConfig } from './google-drive';
import { GoogleOAuthHandler } from './google-oauth';
import { generateAllMeals, generateCategoryOptions } from './claude';
import { Recipe } from '../shared/types';
import { prepareRecipeForCatalog } from '../shared/recipeUtils';
import { buildShoppingLink } from './instacart';
import { settingsManager } from './settings';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let driveStore: GoogleDriveStore | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../renderer/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  initializeDriveStore().then(() => {
    createWindow();
    setupMenu();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

async function initializeDriveStore() {
  const configDir = path.join(app.getPath('userData'), 'config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const credentialsPath = path.join(configDir, 'google-credentials.json');
  const tokenPath = path.join(configDir, 'google-token.json');

  // Check if credentials exist; if not, create placeholder
  if (!fs.existsSync(credentialsPath)) {
    fs.writeFileSync(
      credentialsPath,
      JSON.stringify(
        {
          installed: {
            client_id: 'PLACEHOLDER',
            client_secret: 'PLACEHOLDER',
            redirect_uris: ['urn:ietf:wg:oauth:2.0:oob'],
          },
        },
        null,
        2
      )
    );
  }

  if (!fs.existsSync(tokenPath)) {
    fs.writeFileSync(
      tokenPath,
      JSON.stringify(
        {
          access_token: 'PLACEHOLDER',
          refresh_token: 'PLACEHOLDER',
          token_type: 'Bearer',
          expiry_date: 0,
        },
        null,
        2
      )
    );
  }

  try {
    const oauthTokens = await settingsManager.getGoogleOAuthTokens();
    const oauthConfig = await settingsManager.getGoogleOAuthConfig();

    const savedSpreadsheetId = await settingsManager.getGoogleDriveSpreadsheetId();
    const googleDriveConfig: GoogleDriveConfig = {
      credentialsPath,
      tokenPath,
      sheetTitle: 'Meal Prep Planner',
      googleOAuthTokens: oauthTokens || undefined,
      spreadsheetId: savedSpreadsheetId || undefined,
    };

    if (oauthConfig && oauthConfig.clientId && oauthConfig.clientSecret) {
      // Ensure credentials file is in sync with current config.
      fs.writeFileSync(
        credentialsPath,
        JSON.stringify(
          {
            installed: {
              client_id: oauthConfig.clientId,
              client_secret: oauthConfig.clientSecret,
              redirect_uris: ['http://localhost:49152/oauth2callback'],
            },
          },
          null,
          2
        )
      );
    }

    driveStore = new GoogleDriveStore(googleDriveConfig);
    await driveStore.readRecipes();
  } catch (err) {
    console.warn('Could not initialize Google Drive store:', err);
  }
}

// IPC Handlers
ipcMain.handle('recipes:getAll', async () => {
  try {
    if (!driveStore) return [];
    return driveStore.readRecipes();
  } catch (err) {
    console.error('Error reading recipes:', err);
    return [];
  }
});

ipcMain.handle('meals:searchRecipe', async (_event, query: string, category: string) => {
  try {
    const apiKey = await settingsManager.getClaudeApiKey();
    if (!apiKey) throw new Error('Claude API key not configured.');
    const { ClaudeClient } = await import('./claudeClient');
    const client = new ClaudeClient(apiKey);
    const isUrl = query.startsWith('http');
    const result = isUrl
      ? await client.extractRecipeFromUrl(query)
      : await client.searchAndSelectRecipe(query, category as any);
    const { v4: uuidv4 } = await import('uuid');
    return { ...result, id: uuidv4(), category, isFromCatalog: false, timesSelected: 0, savedAt: new Date().toISOString(), tags: result.tags || [] };
  } catch (err) {
    console.error('Error searching recipe:', err);
    throw err;
  }
});

ipcMain.handle('meals:generateCategory', async (_event, category: string, pinnedRecipes: Recipe[] = []) => {
  try {
    const apiKey = await settingsManager.getClaudeApiKey();
    if (!apiKey) throw new Error('Claude API key not configured.');

    let recentIds: string[] = [];
    let recipes: Recipe[] = [];
    if (driveStore) {
      try {
        recentIds = await driveStore.getRecentRecipeUses(4);
        recipes = await driveStore.readRecipes();
      } catch (driveErr) {
        console.warn('Google Drive unavailable:', (driveErr as Error).message);
      }
    }
    const userPreferences = await settingsManager.getUserPreferences();

    return await generateCategoryOptions({
      category: category as any,
      existingRecipes: recipes,
      recentRecipeIds: recentIds,
      apiKey,
      userPreferences,
      pinnedRecipes,
    });
  } catch (err) {
    console.error('Error generating category:', err);
    throw err;
  }
});

ipcMain.handle('meals:generate', async () => {
  try {
    const apiKey = await settingsManager.getClaudeApiKey();
    if (!apiKey) {
      throw new Error('Claude API key not configured. Please set it in Settings.');
    }

    let recentIds: string[] = [];
    let recipes: any[] = [];
    if (driveStore) {
      try {
        recentIds = await driveStore.getRecentRecipeUses(4);
        recipes = await driveStore.readRecipes();
      } catch (driveErr) {
        console.warn('Google Drive unavailable, generating without catalog:', (driveErr as Error).message);
      }
    }
    const userPreferences = await settingsManager.getUserPreferences();

    const generated = await generateAllMeals({
      existingRecipes: recipes,
      recentRecipeIds: recentIds,
      apiKey,
      userPreferences,
    });

    return generated;
  } catch (err) {
    console.error('Error generating meals:', err);
    throw err;
  }
});

ipcMain.handle('plan:save', async (event, plan) => {
  try {
    if (driveStore) {
      try {
        const fileUrl = await driveStore.recordWeeklyPlan(plan);
        return { success: true, fileUrl };
      } catch (driveErr) {
        console.error('Could not save plan to Google Drive:', driveErr);
        return { success: false, fileUrl: null };
      }
    }
    return { success: true, fileUrl: null };
  } catch (err) {
    console.error('Error saving plan:', err);
    return { success: false, fileUrl: null };
  }
});

ipcMain.handle('recipe:save', async (event, recipe) => {
  try {
    if (!driveStore) return false;
    const recipes = await driveStore.readRecipes();
    const existingIndex = recipes.findIndex((r) => r.id === recipe.id);
    const nameExists = recipes.some((r) => r.name.toLowerCase() === recipe.name.toLowerCase());
    if (existingIndex >= 0) {
      recipes[existingIndex] = recipe;
    } else if (!nameExists) {
      recipes.push(prepareRecipeForCatalog(recipe, recipes));
    }
    await driveStore.writeRecipes(recipes);
    return true;
  } catch (err) {
    console.error('Error saving recipe:', err);
    return false;
  }
});

// Instacart Handlers
ipcMain.handle('instacart:generateLink', async (_event, plan) => {
  try {
    const apiKey = await settingsManager.getInstacartApiKey();
    if (!apiKey) throw new Error('Instacart API key not configured.');
    const url = await buildShoppingLink(plan, apiKey);
    shell.openExternal(url);
    return { success: true, url };
  } catch (err) {
    console.error('Instacart error:', err);
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('settings:getInstacartApiKey', async () => settingsManager.getInstacartApiKey());
ipcMain.handle('settings:setInstacartApiKey', async (_event, key: string) => {
  await settingsManager.setInstacartApiKey(key);
  return true;
});
ipcMain.handle('settings:hasInstacartApiKey', async () => settingsManager.hasInstacartApiKey());

// Settings Handlers
ipcMain.handle('settings:getClaudeApiKey', async () => {
  return await settingsManager.getClaudeApiKey();
});

ipcMain.handle('settings:setClaudeApiKey', async (event, key: string) => {
  await settingsManager.setClaudeApiKey(key);
  return true;
});

ipcMain.handle('settings:getUserPreferences', async () => {
  return await settingsManager.getUserPreferences();
});

ipcMain.handle('settings:setUserPreferences', async (event, prefs: string) => {
  await settingsManager.setUserPreferences(prefs);
  return true;
});

ipcMain.handle('settings:hasClaudeApiKey', async () => {
  const result = await settingsManager.hasClaudeApiKey();
  const all = await settingsManager.getAll();
  console.log('[settings] userData path:', app.getPath('userData'));
  console.log('[settings] hasClaudeApiKey:', result, '| keys found:', Object.keys(all));
  return result;
});

// OAuth Handlers
ipcMain.handle('oauth:hasTokens', async () => {
  return await settingsManager.hasGoogleOAuthTokens();
});

ipcMain.handle('oauth:setConfig', async (event, config: { clientId: string; clientSecret: string }) => {
  try {
    await settingsManager.setGoogleOAuthConfig(config);
    return true;
  } catch (err) {
    console.error('Error setting OAuth config:', err);
    return false;
  }
});

ipcMain.handle('oauth:getConfig', async () => {
  return (await settingsManager.getGoogleOAuthConfig()) || null;
});

ipcMain.handle('oauth:startAuthFlow', async () => {
  try {
    const config = await settingsManager.getGoogleOAuthConfig();
    if (!config) {
      throw new Error('Google OAuth config not set. Please configure Client ID and Secret in Settings.');
    }

    const redirectUri = 'http://localhost:49152/oauth2callback';
    const handler = new GoogleOAuthHandler({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri,
    });

    const tokens = await handler.startAuthFlow(mainWindow);
    await settingsManager.setGoogleOAuthTokens(tokens);
    // Reinitialize Drive store with fresh tokens
    await initializeDriveStore();
    return { success: true, message: 'Successfully authenticated with Google Drive' };
  } catch (err) {
    console.error('Error during OAuth flow:', err);
    throw err;
  }
});

ipcMain.handle('oauth:disconnect', () => {
  try {
    settingsManager.setGoogleOAuthTokens({} as any);
    return true;
  } catch (err) {
    console.error('Error disconnecting OAuth:', err);
    return false;
  }
});

function setupMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'Exit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
