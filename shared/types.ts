export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'dessert';

export interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
  section?: string;
}

export interface Recipe {
  id: string;
  name: string;
  category: MealCategory;
  subcategory?: string;
  sourceUrl: string;
  description: string;
  calories?: number;
  proteinGrams?: number;
  carbGrams?: number;
  fatGrams?: number;
  servings?: number;
  prepTime?: number;
  tags: string[];
  ingredients: Ingredient[];
  savedAt: string;
  isFromCatalog: boolean;
  notes?: string;
}

export interface SelectedMeal {
  recipe: Recipe;
  isCustomEntry: boolean;
  servingsNeeded?: number;
  selectedAt: string;
}

export interface WeeklyPlan {
  id: string;
  weekStartDate: string;
  breakfast?: SelectedMeal;
  lunch?: SelectedMeal;
  dinner: SelectedMeal[]; // 2-3 entries
  dessert?: SelectedMeal;
  groceryListSentAt?: string;
  instacartListUrl?: string;
}

export interface MealSlotOptions {
  category: MealCategory;
  options: Recipe[]; // 10 for breakfast/lunch/dessert, 20 for dinner
  isLoading: boolean;
  generatedAt: string;
}
