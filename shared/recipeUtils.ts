import { Recipe, MealCategory } from './types';

const VALID_CATEGORIES: MealCategory[] = ['breakfast', 'lunch', 'dinner', 'dessert'];

export interface RecipeValidationError {
  field: string;
  message: string;
}

/**
 * Validates that a recipe matches the MealPrepRecipes sheet schema.
 * sourceUrl is allowed to be empty/null per spec.
 */
export function validateRecipeSchema(recipe: Recipe): RecipeValidationError[] {
  const errors: RecipeValidationError[] = [];

  if (!recipe.id || !/^\d+$/.test(recipe.id)) {
    errors.push({ field: 'id', message: 'id must be a positive integer string' });
  }
  if (!recipe.name || typeof recipe.name !== 'string' || recipe.name.trim() === '') {
    errors.push({ field: 'name', message: 'name must be a non-empty string' });
  }
  if (!VALID_CATEGORIES.includes(recipe.category)) {
    errors.push({ field: 'category', message: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }
  if (recipe.subcategory !== undefined && typeof recipe.subcategory !== 'string') {
    errors.push({ field: 'subcategory', message: 'subcategory must be a string if present' });
  }
  if (recipe.description !== undefined && typeof recipe.description !== 'string') {
    errors.push({ field: 'description', message: 'description must be a string if present' });
  }
  if (recipe.servings !== undefined && (typeof recipe.servings !== 'number' || recipe.servings < 0)) {
    errors.push({ field: 'servings', message: 'servings must be a non-negative number if present' });
  }
  // sourceUrl is intentionally allowed to be empty/null
  if (recipe.sourceUrl !== undefined && recipe.sourceUrl !== null && typeof recipe.sourceUrl !== 'string') {
    errors.push({ field: 'sourceUrl', message: 'sourceUrl must be a string or null' });
  }
  if (!Array.isArray(recipe.ingredients)) {
    errors.push({ field: 'ingredients', message: 'ingredients must be an array' });
  }
  if (!recipe.isFromCatalog) {
    errors.push({ field: 'isFromCatalog', message: 'isFromCatalog must be true for catalog recipes' });
  }

  return errors;
}

/**
 * Prepares a new recipe to be inserted into the catalog:
 * - Assigns the next sequential integer ID
 * - Marks isFromCatalog: true
 *
 * If the recipe already exists in the catalog (same id), returns it unchanged.
 */
export function prepareRecipeForCatalog(recipe: Recipe, existingRecipes: Recipe[]): Recipe {
  const alreadyExists = existingRecipes.some((r) => r.id === recipe.id);
  if (alreadyExists) return recipe;

  const maxId = existingRecipes.reduce((max, r) => {
    const n = parseInt(r.id, 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);

  return {
    ...recipe,
    id: String(maxId + 1),
    savedAt: new Date().toISOString(),
    isFromCatalog: true,
  };
}
