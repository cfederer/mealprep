import { google } from 'googleapis';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { Recipe, WeeklyPlan, MealCategory, Ingredient } from '../shared/types';
import { GoogleOAuthTokens } from './settings';

export interface GoogleDriveConfig {
  credentialsPath: string;
  tokenPath: string;
  sheetTitle: string;
  googleOAuthTokens?: GoogleOAuthTokens;
  spreadsheetId?: string;
}

const SHEETS = {
  recipes: 'Recipes',
  weeklyPlans: 'WeeklyPlans',
  thisWeekPlan: 'ThisWeekPlan',
  settings: 'Settings',
  info: 'Info',
};

export class GoogleDriveStore {
  private oauth2Client: any;
  private drive: any;
  private config: GoogleDriveConfig;
  private spreadsheetId: string | null = null;

  constructor(config: GoogleDriveConfig) {
    this.config = config;
    if (config.spreadsheetId) {
      this.spreadsheetId = config.spreadsheetId;
    }
    const credentials = JSON.parse(fs.readFileSync(config.credentialsPath, 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    this.oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    let token: any;
    if (config.googleOAuthTokens) {
      token = config.googleOAuthTokens;
    } else {
      token = JSON.parse(fs.readFileSync(config.tokenPath, 'utf8'));
    }

    this.oauth2Client.setCredentials(token);
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  async findOrCreateSpreadsheet() {
    if (this.spreadsheetId) return this.spreadsheetId;

    // try find existing
    const res = await this.drive.files.list({
      q: `name='${this.config.sheetTitle}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (res.data.files && res.data.files.length > 0) {
      this.spreadsheetId = res.data.files[0].id;
      return this.spreadsheetId;
    }

    // create new sheet with required tabs
    const createRes = await this.drive.files.create({
      requestBody: {
        name: this.config.sheetTitle,
        mimeType: 'application/vnd.google-apps.spreadsheet',
      },
      fields: 'id',
    });

    this.spreadsheetId = createRes.data.id;

    // then initialize via Sheets API
    await this.setupSheetTabs();

    return this.spreadsheetId;
  }

  async setupSheetTabs() {
    const sheetsApi = google.sheets({ version: 'v4', auth: this.oauth2Client });
    if (!this.spreadsheetId) throw new Error('Spreadsheet ID is missing during setup.');

    const requests = [
      { addSheet: { properties: { title: SHEETS.recipes } } },
      { addSheet: { properties: { title: SHEETS.weeklyPlans } } },
      { addSheet: { properties: { title: SHEETS.thisWeekPlan } } },
      { addSheet: { properties: { title: SHEETS.settings } } },
      { addSheet: { properties: { title: SHEETS.info } } },
    ];

    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { requests },
    });

    await this.writeHeaders();
  }

  async writeHeaders() {
    if (!this.spreadsheetId) throw new Error('Spreadsheet not initialized.');

    const sheetsApi = google.sheets({ version: 'v4', auth: this.oauth2Client });
    const now = new Date().toISOString();
    const recipeHeader = [
      'id', 'name', 'category', 'subcategory', 'sourceUrl', 'sourceName', 'description', 'proteinGrams', 'servings', 'prepTime', 'tags', 'ingredients', 'savedAt', 'timesSelected', 'lastSelectedAt', 'isFromCatalog', 'notes', 'generatedOn',
    ];

    const weeklyHeader = [
      'planId', 'weekStartDate', 'breakfastRecipeIds', 'lunchRecipeIds', 'dinnerRecipeIds', 'dessertRecipeIds', 'generatedAt', 'groceryListSentAt', 'instacartPlanUrls', 'notes',
    ];

    const thisWeekHeader = [
      'weekStartDate', 'selectedRecipeId', 'category', 'servingsNeeded', 'isCustom', 'selectedAt',
    ];

    const settingsHeader = ['key', 'value'];
    const infoHeader = ['createdAt', 'lastSyncedAt'];

    await sheetsApi.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          { range: `${SHEETS.recipes}!A1:Z1`, values: [[`createdAt: ${now}`]] },
          { range: `${SHEETS.recipes}!A2:R2`, values: [recipeHeader] },
          { range: `${SHEETS.weeklyPlans}!A1:J1`, values: [[`createdAt: ${now}`]] },
          { range: `${SHEETS.weeklyPlans}!A2:J2`, values: [weeklyHeader] },
          { range: `${SHEETS.thisWeekPlan}!A1:F1`, values: [[`createdAt: ${now}`]] },
          { range: `${SHEETS.thisWeekPlan}!A2:F2`, values: [thisWeekHeader] },
          { range: `${SHEETS.settings}!A1:B1`, values: [[`createdAt: ${now}`, '']] },
          { range: `${SHEETS.settings}!A2:B2`, values: [settingsHeader] },
          { range: `${SHEETS.info}!A1:B1`, values: [[now, now]] },
        ],
      },
    });
  }

  async readRecipes(): Promise<Recipe[]> {
    const sheetsApi = google.sheets({ version: 'v4', auth: this.oauth2Client });
    await this.findOrCreateSpreadsheet();

    // Read header row first to map columns dynamically
    const headerRes = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId!,
      range: `${SHEETS.recipes}!1:1`,
    });
    const headers: string[] = (headerRes.data.values?.[0] || []).map((h: string) => String(h).trim().toLowerCase());

    const col = (name: string) => headers.indexOf(name);

    const valueRes = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId!,
      range: `${SHEETS.recipes}!A2:Z`,
    });

    const rows = valueRes.data.values || [];
    const seenIds = new Set<string>();
    return rows
      .filter((row: any[]) => row[col('name')] && row[col('category')])
      .filter((row: any[]) => {
        const id = String(row[col('id')] ?? '');
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      })
      .map((row: any[]) => {
        const get = (name: string) => row[col(name)] ?? '';

        // Parse ingredients: supports plain string or JSON array; also handles old 'ingredientsJSON' header
        const rawIngredients = get('ingredients') || get('ingredientsjson');
        let ingredients: Ingredient[] = [];
        if (rawIngredients) {
          try {
            ingredients = JSON.parse(rawIngredients);
          } catch {
            // Plain comma-separated string — convert to simple ingredient objects
            ingredients = String(rawIngredients)
              .split(',')
              .map((s) => ({ name: s.trim(), quantity: '', unit: '', section: '' }))
              .filter((i) => i.name);
          }
        }

        return {
          id: get('id') || String(Math.random()),
          name: get('name'),
          category: get('category') as MealCategory,
          subcategory: get('subcategory'),
          sourceUrl: get('sourceurl') || get('sourceUrl'),
          description: get('description'),
          calories: get('calories') ? Number(get('calories')) : undefined,
          proteinGrams: get('proteingrams') ? Number(get('proteingrams')) : undefined,
          carbGrams: get('carbgrams') ? Number(get('carbgrams')) : undefined,
          fatGrams: get('fatgrams') ? Number(get('fatgrams')) : undefined,
          servings: get('servings') ? Number(get('servings')) : undefined,
          prepTime: get('preptime') ? Number(get('preptime')) : undefined,
          tags: get('tags') ? String(get('tags')).split(/[;,]/).map((t) => t.trim()).filter(Boolean) : [],
          ingredients,
          savedAt: get('savedat') || get('savedAt') || new Date().toISOString(),
          isFromCatalog: true,
          notes: get('notes'),
        } as Recipe;
      });
  }

  async writeRecipes(recipes: Recipe[]) {
    const sheetsApi = google.sheets({ version: 'v4', auth: this.oauth2Client });
    await this.findOrCreateSpreadsheet();

    // Read header row to write columns in the correct order
    const headerRes = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId!,
      range: `${SHEETS.recipes}!1:1`,
    });
    const headers: string[] = (headerRes.data.values?.[0] || []).map((h: string) =>
      String(h).trim().toLowerCase()
    );

    const fieldMap = (r: Recipe): Record<string, any> => ({
      id: r.id,
      name: r.name,
      category: r.category,
      subcategory: r.subcategory || '',
      description: r.description || '',
      servings: r.servings ?? '',
      sourceurl: r.sourceUrl || '',
      ingredients: JSON.stringify(r.ingredients),
      calories: r.calories ?? '',
      proteingrams: r.proteinGrams ?? '',
      carbgrams: r.carbGrams ?? '',
      fatgrams: r.fatGrams ?? '',
      preptime: r.prepTime ?? '',
      tags: (r.tags || []).join(', '),
      savedat: r.savedAt || '',
      isfromcatalog: String(r.isFromCatalog ?? true),
      notes: r.notes || '',
    });

    const values = recipes.map((r) => {
      const map = fieldMap(r);
      return headers.map((h) => map[h] ?? '');
    });

    const lastCol = String.fromCharCode(64 + Math.max(headers.length, 1));
    await sheetsApi.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId!,
      range: `${SHEETS.recipes}!A2:${lastCol}`,
    });
    if (values.length === 0) return;

    await sheetsApi.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId!,
      range: `${SHEETS.recipes}!A2:${lastCol}${2 + values.length - 1}`,
      valueInputOption: 'RAW',
      requestBody: { values },
    });
  }

  async recordWeeklyPlan(plan: WeeklyPlan): Promise<string> {
    const FOLDER_ID = '1G4ICi91Qj-yU8JTtYOUBMcCes_NslOM4';
    const title = `Weekly Meal Prep for ${plan.weekStartDate}`;

    // Create a Google Doc
    const createRes = await this.drive.files.create({
      requestBody: {
        name: title,
        mimeType: 'application/vnd.google-apps.document',
        parents: [FOLDER_ID],
      },
      fields: 'id',
    });

    const docId = createRes.data.id;
    const docsApi = google.docs({ version: 'v1', auth: this.oauth2Client });

    const requests: any[] = [];
    let cursor = 1; // Google Docs inserts at index, we track position

    const insertText = (text: string) => {
      requests.push({ insertText: { location: { index: cursor }, text } });
      cursor += text.length;
    };

    const applyStyle = (startOffset: number, length: number, style: any) => {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: startOffset, endIndex: startOffset + length },
          paragraphStyle: style,
          fields: 'namedStyleType',
        },
      });
    };

    // Title
    const titleText = `Grocery List — ${plan.weekStartDate}\n`;
    const titleStart = cursor;
    insertText(titleText);
    applyStyle(titleStart, titleText.length, { namedStyleType: 'TITLE' });

    const meals: { label: string; meal: any }[] = [];
    if (plan.breakfast) meals.push({ label: 'Breakfast', meal: plan.breakfast });
    if (plan.lunch) meals.push({ label: 'Lunch', meal: plan.lunch });
    (plan.dinner || []).forEach((d) => meals.push({ label: 'Dinner', meal: d }));

    for (const { label, meal } of meals) {
      if (!meal?.recipe) continue;
      const r = meal.recipe;
      const servings = meal.servingsNeeded ?? r.servings;

      // Recipe heading
      const heading = `${label}: ${r.name}${servings ? ` (serves ${servings})` : ''}\n`;
      const headingStart = cursor;
      insertText(heading);
      applyStyle(headingStart, heading.length, { namedStyleType: 'HEADING_2' });

      // URL on its own line
      if (r.sourceUrl) {
        insertText(`${r.sourceUrl}\n`);
      }

      // Ingredients as bullet points
      const ingredients: any[] = Array.isArray(r.ingredients) ? r.ingredients : [];
      const ingredientLines: string[] = ingredients.length > 0
        ? ingredients.map((i: any) => {
            const qty = [i.quantity, i.unit].filter(Boolean).join(' ');
            return `${qty ? qty + ' ' : ''}${i.name}`;
          })
        : typeof r.ingredients === 'string'
          ? String(r.ingredients).split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];

      if (ingredientLines.length > 0) {
        const bulletStart = cursor;
        ingredientLines.forEach((line) => insertText(`${line}\n`));
        requests.push({
          createParagraphBullets: {
            range: { startIndex: bulletStart, endIndex: cursor - 1 },
            bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
          },
        });
      }

      insertText('\n');
    }

    // Staples section
    const staplesHeading = 'Staples\n';
    const staplesStart = cursor;
    insertText(staplesHeading);
    applyStyle(staplesStart, staplesHeading.length, { namedStyleType: 'HEADING_2' });

    const staples = [
      'Iced coffee',
      'Seltzers',
      'Creamer',
      'Bread',
      'PB',
      'Fruit',
      'Yogurts',
      'Protein shakes',
      'Protein bars: Quest Hero',
      'Waters',
      'Kombucha',
      'Ninjas',
      'Graham crackers',
      '2% milk',
      'Unsweetened almond milk',
      'Chocolate chips',
      'Broth',
      'Cheese',
    ];
    const staplesListStart = cursor;
    staples.forEach((s) => insertText(`${s}\n`));
    requests.push({
      createParagraphBullets: {
        range: { startIndex: staplesListStart, endIndex: cursor - 1 },
        bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
      },
    });

    await docsApi.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests },
    });

    return `https://docs.google.com/document/d/${docId}`;
  }

  async getRecentRecipeUses(_weeks = 4): Promise<string[]> {
    return [];
  }
}
