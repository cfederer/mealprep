import { Recipe, MealCategory, MealSlotOptions } from '../shared/types';
import { ClaudeClient } from './claudeClient';

export interface GenerateOptionsArgs {
  category: MealCategory;
  existingRecipes: Recipe[];
  recentRecipeIds: string[];
  apiKey: string;
  userPreferences?: string;
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
  const { category, existingRecipes, recentRecipeIds, apiKey, userPreferences, _delayMs = 15000 } = args;

  const client = new ClaudeClient(apiKey);

  const catalogCandidates = existingRecipes.filter(
    (r) => r.category === category && !recentRecipeIds.includes(r.id)
  );

  // Breakfast: 4 egg muffins + 4 scrambles + 2 other (catalog) + 2 new = 10 total
  // Lunch: 8 catalog + 2 new = 10
  // Dinner: 10 catalog + 10 new = 20
  const totalTarget = category === 'dinner' ? 20 : 10;
  const newTarget = category === 'dinner' ? 10 : 2;
  const catalogTarget = totalTarget - newTarget;

  const chosenCatalog =
    category === 'breakfast'
      ? selectBreakfastFromCatalog(catalogCandidates).slice(0, catalogTarget)
      : pickOrAll(catalogCandidates, catalogTarget);

  // Generate new recipes — Claude returns 2 per call
  let generatedRecipes: Recipe[] = [];
  const callsNeeded = Math.ceil(newTarget / 2);
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
    // Rate limit: delay between calls except after the last one
    if (i < callsNeeded - 1) await delay(_delayMs);
  }

  const selectedNew = shuffle(generatedRecipes)
    .slice(0, newTarget)
    .map((r) => ({ ...r, isFromCatalog: false }));

  const combined = [...chosenCatalog, ...selectedNew];
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
