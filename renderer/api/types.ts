import { Recipe } from '../../shared/types';

export interface MealPrepAPI {
  recipes: {
    getAll: () => Promise<Recipe[]>;
  };
  meals: {
    generate: () => Promise<any>;
    generateCategory: (category: string, pinnedRecipes?: Recipe[]) => Promise<any>;
    searchRecipe: (query: string, category: string) => Promise<any>;
  };
  plan: {
    save: (plan: any) => Promise<{ success: boolean; fileUrl: string | null }>;
  };
  instacart: {
    generateLink: (plan: any) => Promise<{ success: boolean; url?: string; error?: string }>;
    hasApiKey: () => Promise<boolean>;
  };
  recipe: {
    save: (recipe: any) => Promise<boolean>;
  };
  settings: {
    getClaudeApiKey: () => Promise<string | undefined>;
    setClaudeApiKey: (key: string) => Promise<void>;
    getUserPreferences: () => Promise<string | undefined>;
    setUserPreferences: (prefs: string) => Promise<void>;
    hasClaudeApiKey: () => Promise<boolean>;
    getInstacartApiKey: () => Promise<string | undefined>;
    setInstacartApiKey: (key: string) => Promise<void>;
  };
  oauth: {
    hasTokens: () => Promise<boolean>;
    setConfig: (config: { clientId: string; clientSecret: string }) => Promise<boolean>;
    getConfig: () => Promise<{ clientId: string; clientSecret: string } | null>;
    startAuthFlow: () => Promise<{ success: boolean; message: string }>; 
    disconnect: () => Promise<boolean>;
  };
}

declare global {
  interface Window {
    mealPrepAPI: MealPrepAPI;
  }
}
