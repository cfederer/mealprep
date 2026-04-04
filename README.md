# Meal Prep Planner

An Electron-based desktop application that automates weekly meal planning using Claude AI, Google Drive, and Instacart.

## Quick Start

### Prerequisites
- Node.js 18+
- npm
- Google Drive API credentials (optional for local testing)
- Claude API key (optional for local testing)

### Installation

```bash
cd /Users/calliefederer/Documents/mealprep/MealPrep
npm install
```

### Development

Run both the Electron main process and Vite dev server in parallel:

```bash
npm run dev
```

This starts:
- TypeScript watcher (`npm run dev-main`)
- Vite dev server on http://localhost:5173 (`npm run dev-renderer`)
- Electron app pointing to the dev server

### Build for Production

```bash
npm run build
```

This runs:
- Type checking (`npm run type-check`)
- Main process compilation (`npm run build-main`)
- React renderer bundling (`npm run build-renderer`)

Output goes to `dist/` directory.

### Run Built App

```bash
npm start
```

Launches the Electron app from dist/ artifacts.

## Architecture

### Directory Structure

```
MealPrep/
├── main/
│   ├── electron.ts        # Electron main process entry
│   ├── preload.ts         # IPC context bridge
│   ├── google-drive.ts    # Google Sheets sync
│   ├── claude.ts          # Meal generation logic
│   └── instacart.ts       # Instacart list management
├── renderer/
│   ├── index.html         # HTML entry point (Vite)
│   ├── index.tsx          # React root
│   ├── App.tsx            # Main React component
│   ├── App.css            # Global styles
│   ├── pages/
│   │   └── WeeklyPlanner.tsx  # Main planner UI
│   ├── components/
│   │   ├── MealSlot.tsx       # Meal category slot
│   │   ├── RecipeCard.tsx     # Individual recipe card
│   │   └── CategoryBadge.tsx  # Category label
│   └── store/
│       └── planStore.ts       # Zustand state management
├── shared/
│   └── types.ts           # TypeScript interfaces
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript config
└── package.json
```

### Tech Stack

- **Desktop**: Electron 30
- **UI**: React 18 + TypeScript
- **Styling**: Tailwind CSS (CDN in development, bundled in production)
- **State**: Zustand
- **IPC**: Electron context bridge (secure)
- **Data**: Google Sheets API
- **AI**: Claude API (placeholder integration)
- **Build**: TypeScript + Vite

## Features

### Weekly Planner (Main Screen)

- **Category slots**: Breakfast, Lunch, Dinner (2-3 selections), Dessert (optional)
- **Option display**: 10 options for breakfast/lunch/dessert, 20 for dinner
- **Generation**: Combines 50% catalog recipes + 50% AI-discovered recipes
- **Selection**: Click recipe cards to select; adjust servings per meal
- **Actions**: 
  - Generate My Week
  - Clear Plan
  - Send to Instacart (enabled when selections made)

### Recipe Management

- **Catalog**: Synced with Google Sheets
- **Auto-avoid**: Excludes recipes used in last 4 weeks
- **Persistence**: Saves to Google Drive

### Instacart Integration (Placeholder)

- Check existing lists by recipe title
- Create list for recipe if missing
- Add missing ingredients to existing lists

## Configuration

Google Sheets credentials are placed in:  
`~/Library/Application Support/meal-prep-planner/config/google-credentials.json`

Tokens and settings stored via `electron-store` (encrypted).

## IPC API

The preload bridge exposes:

```
window.mealPrepAPI.recipes.getAll()
window.mealPrepAPI.meals.generate()
window.mealPrepAPI.plan.save(plan)
window.mealPrepAPI.recipe.save(recipe)
```

## Development Notes

- Type checking: `npm run type-check`
- Build main only: `npm run build-main`
- Build renderer only: `npm run build-renderer`
- Hot reload works in dev mode via Vite
- Preload script compiled to `dist/main/preload.js`

## Next Steps

1. Implement real Claude API integration (meal generation)
2. Add Google Drive OAuth flow (Settings page)
3. Add Instacart Connect API client
4. Build Recipe Catalog UI page
5. Add Settings page for API keys and preferences
6. Implement GroceryList review & consolidation
7. Add plan history viewer
8. Package for macOS / Windows distribution

---

*Built with ❤️ for meal planning*
