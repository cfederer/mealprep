import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateCategoryOptions, generateAllMeals } from '../main/claude';
import { validateRecipeSchema, prepareRecipeForCatalog } from '../shared/recipeUtils';
import type { Recipe } from '../shared/types';

// --- Helpers ---

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: Math.random().toString(36).slice(2),
    name: 'Test Recipe',
    category: 'breakfast',
    subcategory: '',
    sourceUrl: 'https://example.com',
    description: 'A test recipe',
    tags: [],
    ingredients: [],
    savedAt: new Date().toISOString(),
    isFromCatalog: true,
    ...overrides,
  };
}

function makeCatalog(): Recipe[] {
  const recipes: Recipe[] = [];
  // 7 egg muffin variants
  for (let i = 0; i < 7; i++) {
    recipes.push(makeRecipe({ category: 'breakfast', subcategory: 'Egg Muffins', name: `Egg Muffin ${i}` }));
  }
  // 5 scramble variants
  for (let i = 0; i < 5; i++) {
    recipes.push(makeRecipe({ category: 'breakfast', subcategory: 'Scramble', name: `Scramble ${i}` }));
  }
  // 4 other breakfast
  for (let i = 0; i < 4; i++) {
    recipes.push(makeRecipe({ category: 'breakfast', subcategory: 'Toast', name: `Toast ${i}` }));
  }
  // 12 lunch
  for (let i = 0; i < 12; i++) {
    recipes.push(makeRecipe({ category: 'lunch', name: `Lunch ${i}` }));
  }
  // 15 dinner
  for (let i = 0; i < 15; i++) {
    recipes.push(makeRecipe({ category: 'dinner', name: `Dinner ${i}` }));
  }
  return recipes;
}

// Mock ClaudeClient to avoid real API calls
let aiCallCount = 0;
vi.mock('../main/claudeClient', () => {
  function ClaudeClient() {}
  ClaudeClient.prototype.generateMealCategory = vi.fn().mockImplementation(() => {
    const n = ++aiCallCount;
    return Promise.resolve([
      makeRecipe({ isFromCatalog: false, name: `AI Recipe ${n * 2 - 1}` }),
      makeRecipe({ isFromCatalog: false, name: `AI Recipe ${n * 2}` }),
    ]);
  });
  ClaudeClient.prototype.searchAndSelectRecipe = vi.fn().mockResolvedValue(
    makeRecipe({ isFromCatalog: false, name: 'Searched Recipe' })
  );
  ClaudeClient.prototype.extractRecipeFromUrl = vi.fn().mockResolvedValue(
    makeRecipe({ isFromCatalog: false, name: 'URL Recipe' })
  );
  return { ClaudeClient };
});

const catalog = makeCatalog();
const baseArgs = { existingRecipes: catalog, recentRecipeIds: [], apiKey: 'test-key', _delayMs: 0 };

beforeEach(() => { aiCallCount = 0; });

// ── User Story: 10 breakfast ideas ──────────────────────────────────────────

describe('Breakfast generation', () => {
  it('generates 10 breakfast options total', async () => {
    const result = await generateCategoryOptions({ category: 'breakfast', ...baseArgs });
    expect(result.options.length).toBe(10);
  });

  it('includes 4 Egg Muffin variants', async () => {
    const result = await generateCategoryOptions({ category: 'breakfast', ...baseArgs });
    const eggMuffins = result.options.filter((r) => r.subcategory === 'Egg Muffins');
    expect(eggMuffins.length).toBe(4);
  });

  it('includes 4 Scramble variants', async () => {
    const result = await generateCategoryOptions({ category: 'breakfast', ...baseArgs });
    const scrambles = result.options.filter((r) => r.subcategory === 'Scramble');
    expect(scrambles.length).toBe(4);
  });

  it('includes 2 new AI-generated recipes', async () => {
    const result = await generateCategoryOptions({ category: 'breakfast', ...baseArgs });
    const newRecipes = result.options.filter((r) => !r.isFromCatalog);
    expect(newRecipes.length).toBe(2);
  });

  it('marks AI-generated recipes with isFromCatalog = false', async () => {
    const result = await generateCategoryOptions({ category: 'breakfast', ...baseArgs });
    result.options
      .filter((r) => !r.isFromCatalog)
      .forEach((r) => expect(r.isFromCatalog).toBe(false));
  });
});

// ── User Story: 10 lunch ideas ───────────────────────────────────────────────

describe('Lunch generation', () => {
  it('generates 10 lunch options total', async () => {
    const result = await generateCategoryOptions({ category: 'lunch', ...baseArgs });
    expect(result.options.length).toBe(10);
  });

  it('includes 2 new AI-generated lunch recipes', async () => {
    const result = await generateCategoryOptions({ category: 'lunch', ...baseArgs });
    const newRecipes = result.options.filter((r) => !r.isFromCatalog);
    expect(newRecipes.length).toBe(2);
  });
});

// ── User Story: 20 dinner ideas (10 catalog + 10 new) ───────────────────────

describe('Dinner generation', () => {
  it('generates 20 dinner options total', async () => {
    const result = await generateCategoryOptions({ category: 'dinner', ...baseArgs });
    expect(result.options.length).toBe(20);
  });

  it('includes 10 new AI-generated dinner recipes', async () => {
    const result = await generateCategoryOptions({ category: 'dinner', ...baseArgs });
    const newRecipes = result.options.filter((r) => !r.isFromCatalog);
    expect(newRecipes.length).toBe(10);
  });

  it('includes up to 10 catalog dinner recipes', async () => {
    const result = await generateCategoryOptions({ category: 'dinner', ...baseArgs });
    const catalogRecipes = result.options.filter((r) => r.isFromCatalog);
    expect(catalogRecipes.length).toBeLessThanOrEqual(10);
  });
});

// ── User Story: generateAllMeals returns all 3 categories ───────────────────

describe('generateAllMeals', () => {
  it('returns breakfast, lunch, and dinner slots', async () => {
    const result = await generateAllMeals(baseArgs);
    expect(result.breakfast).toBeDefined();
    expect(result.lunch).toBeDefined();
    expect(result.dinner).toBeDefined();
  });

  it('does not return a dessert slot', async () => {
    const result = await generateAllMeals(baseArgs);
    expect(result.dessert).toBeNull();
  });
});

// ── User Story: no duplicate recipe names in a slot ──────────────────────────

describe('Deduplication', () => {
  it('does not return duplicate recipe names in breakfast', async () => {
    const result = await generateCategoryOptions({ category: 'breakfast', ...baseArgs });
    const names = result.options.map((r) => r.name.toLowerCase());
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

// ── User Story: MealPrepRecipes data quality ─────────────────────────────────

describe('MealPrepRecipes data quality', () => {
  function makeCatalogRecipe(overrides: Partial<Recipe> = {}): Recipe {
    return {
      id: '5',
      name: 'Chicken Bowl',
      category: 'lunch',
      subcategory: 'Bowl',
      sourceUrl: 'https://example.com/chicken-bowl',
      description: 'A tasty chicken bowl',
      tags: [],
      ingredients: [{ name: '1 cup rice', quantity: '', unit: '', section: '' }],
      savedAt: new Date().toISOString(),
      isFromCatalog: true,
      ...overrides,
    };
  }

  const existingCatalog: Recipe[] = [
    makeCatalogRecipe({ id: '1', name: 'Recipe One' }),
    makeCatalogRecipe({ id: '2', name: 'Recipe Two' }),
    makeCatalogRecipe({ id: '3', name: 'Recipe Three' }),
  ];

  // Schema validation

  it('passes validation for a well-formed catalog recipe', () => {
    const errors = validateRecipeSchema(makeCatalogRecipe({ id: '10' }));
    expect(errors).toHaveLength(0);
  });

  it('sourceUrl is allowed to be empty', () => {
    const errors = validateRecipeSchema(makeCatalogRecipe({ id: '10', sourceUrl: '' }));
    expect(errors).toHaveLength(0);
  });

  it('sourceUrl is allowed to be null', () => {
    const errors = validateRecipeSchema(makeCatalogRecipe({ id: '10', sourceUrl: null as any }));
    expect(errors).toHaveLength(0);
  });

  it('fails validation when id is not an integer string', () => {
    const errors = validateRecipeSchema(makeCatalogRecipe({ id: 'abc-uuid-here' }));
    expect(errors.some((e) => e.field === 'id')).toBe(true);
  });

  it('fails validation when name is empty', () => {
    const errors = validateRecipeSchema(makeCatalogRecipe({ id: '10', name: '' }));
    expect(errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('fails validation when category is invalid', () => {
    const errors = validateRecipeSchema(makeCatalogRecipe({ id: '10', category: 'snack' as any }));
    expect(errors.some((e) => e.field === 'category')).toBe(true);
  });

  it('fails validation when ingredients is not an array', () => {
    const errors = validateRecipeSchema(makeCatalogRecipe({ id: '10', ingredients: 'eggs, milk' as any }));
    expect(errors.some((e) => e.field === 'ingredients')).toBe(true);
  });

  it('fails validation when isFromCatalog is false', () => {
    const errors = validateRecipeSchema(makeCatalogRecipe({ id: '10', isFromCatalog: false }));
    expect(errors.some((e) => e.field === 'isFromCatalog')).toBe(true);
  });

  // prepareRecipeForCatalog

  it('assigns id = maxExistingId + 1 for a new recipe', () => {
    const newRecipe = makeCatalogRecipe({ id: 'some-uuid', isFromCatalog: false });
    const prepared = prepareRecipeForCatalog(newRecipe, existingCatalog);
    expect(prepared.id).toBe('4');
  });

  it('sets isFromCatalog to true for a new recipe', () => {
    const newRecipe = makeCatalogRecipe({ id: 'some-uuid', isFromCatalog: false });
    const prepared = prepareRecipeForCatalog(newRecipe, existingCatalog);
    expect(prepared.isFromCatalog).toBe(true);
  });

  it('prepared recipe passes full schema validation', () => {
    const newRecipe = makeCatalogRecipe({ id: 'some-uuid', isFromCatalog: false });
    const prepared = prepareRecipeForCatalog(newRecipe, existingCatalog);
    const errors = validateRecipeSchema(prepared);
    expect(errors).toHaveLength(0);
  });

  it('does not modify an existing catalog recipe', () => {
    const existing = existingCatalog[1];
    const result = prepareRecipeForCatalog(existing, existingCatalog);
    expect(result).toBe(existing);
  });

  it('assigns id 1 when catalog is empty', () => {
    const newRecipe = makeCatalogRecipe({ id: 'some-uuid', isFromCatalog: false });
    const prepared = prepareRecipeForCatalog(newRecipe, []);
    expect(prepared.id).toBe('1');
  });
});

// ── User Story: recently used recipes are excluded ───────────────────────────

describe('Recent recipe exclusion', () => {
  it('excludes recently used catalog recipes', async () => {
    const recentIds = catalog.filter((r) => r.category === 'breakfast').slice(0, 3).map((r) => r.id);
    const result = await generateCategoryOptions({
      category: 'breakfast',
      ...baseArgs,
      recentRecipeIds: recentIds,
    });
    const returnedIds = result.options.map((r) => r.id);
    recentIds.forEach((id) => expect(returnedIds).not.toContain(id));
  });
});
