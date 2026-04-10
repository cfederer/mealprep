import { Recipe, MealCategory, MealSlotOptions } from '../shared/types';
import { ClaudeClient } from './claudeClient';

export interface GenerateOptionsArgs {
  category: MealCategory;
  existingRecipes: Recipe[];
  recentRecipeIds: string[];
  apiKey: string;
  userPreferences?: string;
  pinnedRecipes?: Recipe[]; // recipes already selected by user — preserved as-is
  _delayMs?: number; // injectable for testing
}

function shuffle<T>(arr: T[]): T[] {
  return arr
    .map((v) => ({ v, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .map((p) => p.v);
}

function pickOrAll<T>(arr: T[], count: number): T[] {
  if (arr.length <= count) return arr;
  return shuffle(arr).slice(0, count);
}

function selectBreakfastFromCatalog(candidates: Recipe[]): Recipe[] {
  const eggMuffins = candidates.filter((r) => r.subcategory === 'Egg Muffins');
  const scrambles = candidates.filter((r) => r.subcategory === 'Scramble');
  const others = candidates.filter(
    (r) => r.subcategory !== 'Egg Muffins' && r.subcategory !== 'Scramble'
  );
  return [
    ...pickOrAll(eggMuffins, 4),
    ...pickOrAll(scrambles, 4),
    ...pickOrAll(others, 2),
  ];
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function generateCategoryOptions(args: GenerateOptionsArgs): Promise<MealSlotOptions> {
  const { category, existingRecipes, recentRecipeIds, apiKey, userPreferences, pinnedRecipes = [], _delayMs = 15000 } = args;

  const client = new ClaudeClient(apiKey);
  const pinnedIds = new Set(pinnedRecipes.map((r) => r.id));
  const pinnedNames = new Set(pinnedRecipes.map((r) => r.name.toLowerCase()));

  // Breakfast: 4 egg muffins + 4 scrambles + 2 other (catalog) + 2 new = 10 total
  // Lunch: 8 catalog + 2 new = 10
  // Dinner: 10 catalog + 10 new = 20
  const totalTarget = category === 'dinner' ? 20 : 10;
  const newTarget = category === 'dinner' ? 10 : 2;

  // Remaining slots after accounting for pinned recipes
  const remainingTotal = Math.max(0, totalTarget - pinnedRecipes.length);
  const remainingNew = Math.min(newTarget, remainingTotal);
  const remainingCatalog = remainingTotal - remainingNew;

  const catalogCandidates = existingRecipes.filter(
    (r) =>
      r.category === category &&
      !recentRecipeIds.includes(r.id) &&
      !pinnedIds.has(r.id) &&
      !pinnedNames.has(r.name.toLowerCase())
  );

  const chosenCatalog =
    remainingCatalog === 0
      ? []
      : category === 'breakfast'
        ? selectBreakfastFromCatalog(catalogCandidates).slice(0, remainingCatalog)
        : pickOrAll(catalogCandidates, remainingCatalog);

  // Generate new AI recipes — Claude returns 2 per call
  let generatedRecipes: Recipe[] = [];
  const callsNeeded = Math.ceil(remainingNew / 2);
  for (let i = 0; i < callsNeeded; i++) {
    try {
      const recipes = await client.generateMealCategory(
        category,
        catalogCandidates,
        recentRecipeIds,
        userPreferences
      );
      generatedRecipes.push(...recipes);
    } catch (err) {
      console.error(`Failed to generate ${category} options (call ${i + 1}):`, err);
    }
    if (i < callsNeeded - 1) await delay(_delayMs);
  }

  const selectedNew = shuffle(generatedRecipes)
    .slice(0, remainingNew)
    .map((r) => ({ ...r, isFromCatalog: false }));

  // Pinned recipes go first, then catalog, then new AI
  const combined = [...pinnedRecipes, ...chosenCatalog, ...selectedNew];
  const seen = new Set<string>();
  const options = combined.filter((r) => {
    const key = r.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    category,
    options,
    isLoading: false,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateAllMeals(options: {
  existingRecipes: Recipe[];
  recentRecipeIds: string[];
  apiKey: string;
  userPreferences?: string;
  _delayMs?: number;
}) {
  const { existingRecipes, recentRecipeIds, apiKey, userPreferences, _delayMs = 15000 } = options;
  const args = { existingRecipes, recentRecipeIds, apiKey, userPreferences, _delayMs };

  const breakfast = await generateCategoryOptions({ category: 'breakfast', ...args });
  await delay(_delayMs);
  const lunch = await generateCategoryOptions({ category: 'lunch', ...args });
  await delay(_delayMs);
  const dinner = await generateCategoryOptions({ category: 'dinner', ...args });

  return { breakfast, lunch, dinner, dessert: null };
}
