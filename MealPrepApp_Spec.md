# Meal Prep Planner — App Specification
**Version:** 1.0
**Target Platform:** macOS / Windows Desktop (Electron)
**Prepared for:** Claude Code

---

## 1. Overview

The Meal Prep Planner is a desktop application that automates Callie's weekly meal planning workflow. Each week, the app uses Claude AI to generate a curated selection of meal options — drawing from both her saved recipe catalog (Recipes.xlsx on Google drive) and new AI-discovered recipes from the web. She selects her meals, catalogs favorites, and sends the grocery list directly to Instacart using Schnucks as her store.

### Core Goals
- Replace the current manual Claude chat session with a dedicated, persistent app
- Surface 10 meal options per category with full regenerate and custom-entry controls
- Maintain a living recipe catalog synced to the existing Recipes.xlsx on Google drive
- Automate Instacart list creation and cart population via Schnucks

---

## 2. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Desktop shell | **Electron** | Cross-platform Mac/Windows, file system + browser access |
| Frontend UI | **React + TypeScript** | Component-based, strong typing |
| Styling | **Tailwind CSS** | Fast, utility-first, clean UI |
| AI / meal generation | **Claude API** (claude-sonnet-4-5 or latest) | Powers meal suggestions and ingredient extraction |
| Recipe storage | **Recipes.xlsx on Google drive** | Syncs with existing spreadsheet; no migration needed |
| Instacart integration | **Instacart Connect API** (primary) / **Playwright browser automation** (fallback) | API preferred; automation fallback if API access not approved |
| Local state / settings | **electron-store** (JSON) | Stores API keys, preferences, weekly plan drafts |
| Recipe search | **Claude web search + Tavily API** | Finds new recipe URLs and ingredient lists |

---

## 3. Application Structure

```
meal-prep-planner/
├── main/                    # Electron main process
│   ├── index.ts             # App entry point
│   ├── google-drive.ts      # Google Drive API: read/write Recipes.xlsx
│   ├── instacart.ts         # Instacart Connect API client
│   ├── instacart-browser.ts # Playwright fallback for Instacart
│   └── claude.ts            # Claude API client (meal gen, ingredient extraction)
├── renderer/                # React frontend
│   ├── pages/
│   │   ├── WeeklyPlanner.tsx    # Main meal selection UI
│   │   ├── RecipeCatalog.tsx    # Browse/manage saved recipes
│   │   ├── GroceryList.tsx      # Review list before sending to Instacart
│   │   └── Settings.tsx         # API keys, store preferences
│   ├── components/
│   │   ├── MealSlot.tsx         # Reusable slot component (5 options + controls)
│   │   ├── RecipeCard.tsx       # Recipe display card
│   │   ├── RecipeForm.tsx       # Add/edit recipe manually
│   │   └── CategoryBadge.tsx    # Meal type label
│   └── store/
│       ├── planStore.ts         # Weekly plan state (Zustand)
│       └── recipeStore.ts       # Recipe catalog state
├── shared/
│   └── types.ts             # Shared TypeScript types
└── assets/
    └── icons/
```

---

## 4. Data Model

### 4.1 Recipe (from Recipes.xlsx)

The app reads and writes to the existing Recipes.xlsx. The spreadsheet has one sheet per meal category. The app expects the following columns — if columns don't exist, it creates them on first sync.

```typescript
interface Recipe {
  id: string;               // UUID, generated on first import
  name: string;             // Recipe name
  category: 'breakfast' | 'lunch' | 'dinner' | 'dessert';
  subcategory?: string;     // e.g. "Egg Muffins", "Salmon", "Veggie", "Pasta"
  sourceUrl: string;        // Full URL to recipe page
  sourceName: string;       // Publisher name (e.g. "Minimalist Baker")
  description: string;      // 1–2 sentence summary
  proteinGrams?: number;    // Approximate protein per serving
  servings?: number;        // Number of servings the recipe makes
  prepTime?: number;        // Minutes
  tags: string[];           // e.g. ["high-protein", "crockpot", "freezer-friendly"]
  ingredients: Ingredient[]; // Parsed ingredient list
  savedAt: string;          // ISO date string
  timesSelected: number;    // How many times chosen in a weekly plan
  lastSelectedAt?: string;  // ISO date of last use
  isFromCatalog: boolean;   // true = from spreadsheet; false = AI-discovered
  notes?: string;           // Callie's personal notes
}

interface Ingredient {
  name: string;             // e.g. "chicken breasts"
  quantity: string;         // e.g. "1.5"
  unit: string;             // e.g. "lbs"
  section?: string;         // e.g. "Produce", "Protein", "Pantry"
}
```

### 4.2 Weekly Plan

```typescript
interface WeeklyPlan {
  id: string;
  weekStartDate: string;     // ISO date (Monday)
  breakfast?: SelectedMeal;
  lunch?: SelectedMeal;
  dinnerSetA: SelectedMeal[];  // 1–2 picks
  dinnerSetB: SelectedMeal[];  // 1 pick
  dessert?: SelectedMeal;
  groceryListSentAt?: string;
  instacartListUrl?: string;
}

interface SelectedMeal {
  recipe: Recipe;
  isCustomEntry: boolean;     // true if user typed their own
  servingsNeeded?: number;    // Override default serving count
}
```

### 4.3 MealSlotOptions (in-memory, per session)

```typescript
interface MealSlotOptions {
  category: 'breakfast' | 'lunch' | 'dinner-a' | 'dinner-b' | 'dessert';
  options: Recipe[];          // Always exactly 5 items
  isLoading: boolean;
  generatedAt: string;
}
```

---

## 5. Feature Specifications

### 5.1 Weekly Planner (Main Screen)

The main screen shows all meal categories for the week. Each category has its own **MealSlot** component.

#### MealSlot Component

Each MealSlot displays **5 recipe options** and three action controls at the bottom:

```
[ Option 1 ] [ Option 2 ] [ Option 3 ] [ Option 4 ] [ Option 5 ]
─────────────────────────────────────────────────────────────────
[ ✏️ Add my own idea... ]          [ 🔄 Regenerate new ideas ]
```

**Option card** shows:
- Recipe name
- Source site name + favicon
- 1-line description
- Protein count (if available)
- Serving count
- `[♡ Save to Catalog]` button (if not already saved)
- Click to select → card highlights with checkmark

**Option 6 — "Add my own idea":**
- Opens a text field inline
- User types a recipe name or URL
- If a URL is provided, Claude extracts the recipe details automatically
- If just a name is provided, Claude searches for matching recipes and asks the user to confirm
- The custom entry is added to the plan and optionally saved to the catalog

**Option 7 — "Regenerate new ideas":**
- Replaces all 10 current options with 10 fresh suggestions
- Previously shown options are excluded from the new batch (no repeats within a session)
- Shows a loading spinner during generation
- Catalog recipes are mixed with newly discovered web recipes at a ~50/50 ratio

**Generation logic (per slot):**
1. Query Claude with the user's meal planning preferences and constraints (from their prompt doc / settings)
2. Pull up to 2–3 matching recipes from the catalog (filtered to avoid recent repeats)
3. Search the web for 2–3 new recipe candidates
4. Return 5 total, deduplicated, sorted by novelty (most recently used catalog items shown last)

#### Meal Categories

| Category | Display Name | # to Select | Description |
|---|---|---|---|
| `breakfast` | 🍳 Breakfast | 1 | Egg muffins, egg bowls, etc. |
| `lunch` | 🥗 Lunch | 1 | Salads, bowls, grain-based meals |
| `dinner-a` | 🍽️ Dinner | 1 | Mexican, pasta, proteins like turkey / chicken and sides |
| `dinner-b` | 🍽️ Dinner | 1 | Mexican, pasta, proteins like turkey / chicken and sides |
| `dessert` | 🍫 Dessert | 1 (optional) | Healthy sweets, protein balls, etc. |

#### Weekly Planner Actions (top of page)

- **"Generate My Week"** — triggers initial 10-option generation for all categories simultaneously
- **"Clear Plan"** — resets all selections
- **"Send to Instacart →"** — enabled once at least one meal is selected; navigates to Grocery List review screen

---

### 5.2 Recipe Catalog

A searchable, filterable library of all saved recipes.

#### Views
- **Grid view** (default): Recipe cards with name, category badge, source, protein count
- **List view**: Compact rows for bulk management

#### Filters / Search
- Search by name, ingredient, or source site
- Filter by category (breakfast / lunch / dinner / dessert)
- Filter by tag (e.g. "crockpot", "freezer-friendly", "high-protein", "30-minutes")
- Sort by: Most recently added | Most often picked | Alphabetical | Highest protein

#### Recipe Detail Panel (side panel or modal)
- Full recipe name, source link (clickable → opens in browser)
- All ingredients with quantities
- Description / notes
- Tags
- Stats: times selected, last used date
- Actions: **Edit**, **Delete**, **Add to this week's plan**

#### Adding New Recipes

Three ways to add:
1. **From URL** — paste a recipe URL; Claude parses name, ingredients, description, servings automatically
2. **From a weekly plan** — click "Save to Catalog" on any option card (also saves after selection)
3. **Manual entry** — form with all Recipe fields

#### Sync with Recipes.xlsx

- On app launch: reads Recipes.xlsx from Google Drive, imports any rows not yet in the local DB
- On save/edit/delete: writes changes back to the matching row in Recipes.xlsx
- Conflict resolution: if the same recipe has been modified in both places, show a diff and ask user to choose
- Sync status indicator in the sidebar (last synced timestamp + "Sync now" button)

---

### 5.3 Grocery List & Instacart Integration

#### Grocery List Review Screen

Before sending to Instacart, the user sees a full ingredient list:

```
📋 Grocery List — Week of March 30

PRODUCE
  • Broccoli, 2 crowns
  • Kale, 1 bunch
  • Sweet potatoes, 3 medium
  ...

PROTEIN
  • Chicken breasts, 1.5 lbs
  • Salmon fillets, 1 lb
  ...

DAIRY
  • Greek yogurt, 32 oz
  • Feta cheese, 4 oz
  ...

PANTRY
  • Soba noodles, 8 oz
  • Tahini, 1 jar
  ...

[ ✏️ Edit list ]   [ 🛒 Send to Instacart via Schnucks ]
```

- Items are automatically consolidated (e.g. 2 separate recipes both needing onions → 1 combined line)
- User can check/uncheck items, edit quantities, or add extras before sending
- Each item is tagged with which recipe needs it (shown as tooltip)

#### Instacart List Creation

For each recipe in the weekly plan, the app creates (or updates) a named **Instacart List**:

- List name: `[Recipe Name] — [Date]`
  e.g. `Sweet Potato Chickpea Buddha Bowl — Mar 30`
- List description / notes field includes:
  - Recipe source URL (if from a website)
  - Or full instructions summary (if custom/catalog-only)
- If a list with that recipe name already exists, the app asks: **Update existing list or create new?**

#### Adding Items to Instacart Cart (Schnucks)

After list creation, items are added to the Schnucks cart on Instacart:

**Primary method — Instacart Connect API:**
- Use `POST /fulfillment/carts/{cart_id}/items` to add items
- Store is set to Schnucks (retailer_id configured in Settings)
- Items are matched by ingredient name; API returns best match; user can review before checkout

**Fallback method — Playwright browser automation:**
- If the API is unavailable or not approved, use Playwright to:
  1. Log into instacart.com (session cookie stored securely in electron-store)
  2. Navigate to Schnucks storefront
  3. Search each ingredient, select the top result, add to cart
  4. Batch requests to minimize tool call count (search → add → next, no idle waits)
- Show a progress bar during automation: "Adding item 12 of 34..."

**Post-send summary:**
- Shows a confirmation screen: items added, any items not found, estimated total
- Link to open the Instacart cart directly in the browser

---

### 5.4 Settings

| Setting | Description |
|---|---|
| Claude API Key | Anthropic API key for meal generation |
| Google Drive Auth | OAuth 2.0 connection to access Recipes.xlsx |
| Recipes.xlsx path | The specific file on Drive to sync with |
| Instacart Auth | OAuth or session cookie for Instacart |
| Default store | Schnucks (Retailer ID stored here) |
| Instacart integration mode | API (preferred) or Browser automation |
| Meal planning preferences | Dietary restrictions, cuisines to avoid, preferred protein goals |
| Recipe catalog prompt | The custom "prompt doc" instructions that guide AI meal suggestions |
| Recent recipe memory | Number of weeks to track "already used" (default: 4 weeks) |

---

## 6. Meal Generation Prompt Design

The Claude API call for generating meal options should include:

```
System prompt:
- User's dietary preferences and restrictions
- Protein goals per meal
- Preferred cuisines and flavor profiles
- List of recipes used in the past N weeks (to avoid repeats)
- Existing catalog recipes (name + category + last used date)
- Instructions: return exactly 5 options per category, mix catalog + new discoveries
- Format: structured JSON per recipe (name, sourceUrl, sourceName, description, proteinGrams, servings, ingredients[])

User prompt:
- "Generate 10 breakfast options for this week."
  (or lunch / dinner-a / dinner-b / dessert)
- Catalog candidates to consider: [list of catalog recipes in this category]
- Exclude recently used: [list of recipe names used in last 4 weeks]
```

The app stores the user's custom instructions from their "prompt doc" in Settings and injects them into every generation call.

---

## 7. Google Drive Integration

### Auth Flow
1. On first launch, user clicks "Connect Google Drive" in Settings
2. App opens OAuth consent screen in the system browser
3. Token stored securely via `electron-store` with encryption
4. Token auto-refreshes; re-auth prompted if refresh fails

### Reading Recipes.xlsx
- Use `googleapis` npm package
- Download file as buffer → parse with `xlsx` (SheetJS)
- Each sheet = one meal category (Breakfast, Lunch, Dinner, Dessert)
- Row = one recipe; columns mapped to Recipe interface

### Writing Recipes.xlsx
- Modify the parsed workbook in memory
- Re-upload via `drive.files.update` with the modified buffer
- Show "Saving..." spinner during upload

---

## 8. Instacart Connect API Notes

**Base URL:** `https://connect.instacart.com/v2`

Key endpoints to implement:
- `GET /retailers` — find Schnucks retailer ID
- `POST /fulfillment/carts` — create a new cart
- `POST /fulfillment/carts/{cart_id}/items` — add items
- `GET /fulfillment/carts/{cart_id}` — review cart before checkout
- `POST /lists` — create a named grocery list with recipe link in description
- `POST /lists/{list_id}/items` — add ingredients to a list

**API access:** Requires applying to the Instacart Developer Platform at https://www.instacart.com/company/developers
**Fallback:** If access is pending, the Playwright browser automation module handles all cart operations.

---

## 9. Development Phases

### Phase 1 — Core Planner (MVP)
- [ ] Electron + React + Tailwind boilerplate
- [ ] Claude API integration for meal generation
- [ ] MealSlot component with 5 options, Add Own, Regenerate
- [ ] All 5 meal categories (Breakfast, Lunch, Dinner A, Dinner B, Dessert)
- [ ] Basic grocery list generation from selected recipes
- [ ] Settings screen with API key management

### Phase 2 — Recipe Catalog + Google Drive Sync
- [ ] Google Drive OAuth flow
- [ ] Read/write Recipes.xlsx (SheetJS)
- [ ] Recipe Catalog page (grid + list view, search, filter)
- [ ] "Save to Catalog" flow from planner
- [ ] Add recipe by URL (Claude parsing)
- [ ] Manual recipe entry form

### Phase 3 — Instacart Integration
- [ ] Instacart Connect API client
- [ ] Grocery List review screen (consolidation, edit, check/uncheck)
- [ ] Instacart list creation with recipe URL in description
- [ ] Cart population via Schnucks
- [ ] Playwright fallback for browser automation
- [ ] Progress tracking and confirmation screen

### Phase 4 — Polish + History
- [ ] Weekly plan history (past plans, pick-again)
- [ ] Recipe usage stats (most picked, last used)
- [ ] Auto-exclusion of recently used recipes
- [ ] Meal planning preferences prompt editor in Settings
- [ ] App auto-updater (electron-updater)
- [ ] Onboarding flow for first-time setup

---

## 10. Non-Functional Requirements

- **Performance:** Meal generation for all 5 categories should complete within 15 seconds (parallel API calls)
- **Offline:** App works offline for catalog browsing; generation and Instacart require internet
- **Security:** API keys and auth tokens stored encrypted via `safeStorage` in Electron
- **Accessibility:** All interactive elements keyboard-navigable; WCAG AA color contrast
- **Auto-save:** Weekly plan draft auto-saved to local store every 30 seconds

---

## 11. Open Questions / Decisions Needed Before Build

1. **Instacart API access** — Apply at https://www.instacart.com/company/developers. If approval takes time, Phase 3 launches with Playwright automation first.
2. **Dessert category** — Should dessert options be required or optional each week? (Recommend: optional, off by default)
3. **Dinner Set A vs B split** — Confirm the current split: Set A = mains (chicken/pasta/chili), Set B = seafood/light veggie. Or merge into one Dinner category with 10 options?
4. **Serving size scaling** — Should ingredients automatically scale if the user changes serving count? (e.g. recipe serves 4, she wants 6)
5. **Staples list** — The current workflow includes staples (drinks, bars, snacks) added to the cart. Should the app have a "Weekly Staples" section that auto-adds these every week?

---

*Spec prepared by Claude · March 28, 2026*
