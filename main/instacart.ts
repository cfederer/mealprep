import { Ingredient, Recipe } from '../shared/types';

export interface InstacartItem {
  name: string;
  quantity: string;
  unit: string;
}

export interface InstacartList {
  id: string;
  title: string;
  items: InstacartItem[];
  createdAt: string;
  sourceRecipeId?: string;
}

export class InstacartClient {
  // Placeholder for a real API client implementation
  private lists: InstacartList[] = [];

  constructor() {
    // initialize from saved credentials / token as needed
  }

  async fetchLists(): Promise<InstacartList[]> {
    // In real implementation this would call Instacart Connect API
    return this.lists;
  }

  async findListByRecipeTitle(title: string): Promise<InstacartList | undefined> {
    const normalized = title.trim().toLowerCase();
    return this.lists.find((list) => list.title.trim().toLowerCase() === normalized);
  }

  async createRecipeList(recipe: Recipe, ingredients: Ingredient[]): Promise<InstacartList> {
    const id = `instacart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newList: InstacartList = {
      id,
      title: recipe.name,
      items: ingredients.map((ing) => ({ name: ing.name, quantity: ing.quantity, unit: ing.unit })),
      createdAt: new Date().toISOString(),
      sourceRecipeId: recipe.id,
    };
    this.lists.push(newList);
    return newList;
  }

  async addMissingIngredients(list: InstacartList, ingredients: Ingredient[]): Promise<InstacartItem[]> {
    const existingNames = new Set(list.items.map((item) => item.name.trim().toLowerCase()));
    const missing = ingredients.filter((ing) => !existingNames.has(ing.name.trim().toLowerCase()));

    const added = missing.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
    }));

    list.items.push(...added);
    return added;
  }
}
