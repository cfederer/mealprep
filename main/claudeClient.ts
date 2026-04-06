import Anthropic from '@anthropic-ai/sdk';
import { Recipe, MealCategory, Ingredient } from '../shared/types';
import { v4 as uuidv4 } from 'uuid';

export class ClaudeClient {
  private client: Anthropic;
  private model = 'claude-sonnet-4-5';

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  private buildGenerationPrompt(
    category: MealCategory,
    catalogRecipes: Recipe[],
    recentRecipeIds: string[],
    userPreferences?: string
  ): string {
    const categoryDescriptions: Record<MealCategory, string> = {
      breakfast: 'breakfast ideas (egg-based, oatmeal, smoothies, etc.)',
      lunch: 'lunch ideas (salads, bowls, grain-based meals)',
      dinner: 'dinner ideas (main courses, proteins with sides)',
      dessert: 'healthy dessert ideas (protein balls, lighter sweets)',
    };

    const recentNames = recentRecipeIds.length > 0
      ? `\n\nIMPORTANT: Avoid these recently used recipes:\n${recentRecipeIds.slice(0, 10).map((id) => {
        const recipe = catalogRecipes.find((r) => r.id === id);
        return recipe ? `- ${recipe.name}` : '';
      }).filter(Boolean).join('\n')}`
      : '';

    const catalogSummary = catalogRecipes.length > 0
      ? `\n\nExisting catalog recipes for ${category}:\n${catalogRecipes
          .slice(0, 5)
          .map((r) => `- ${r.name}`)
          .join('\n')}`
      : '';

    return `You are a meal planning expert helping Callie create a diverse, healthy weekly meal plan.

Generate 2 unique ${categoryDescriptions[category]} for meal planning.

${userPreferences ? `\nUser preferences:\n${userPreferences}` : ''}
${recentNames}
${catalogSummary}

Respond with ONLY a raw JSON array. No markdown, no code blocks, no explanation.
[
  {
    "name": "Recipe Name",
    "sourceUrl": "https://example.com/recipe",
    "description": "One sentence.",
    "servings": 4,
    "calories": 450,
    "proteinGrams": 30,
    "carbGrams": 45,
    "fatGrams": 12,
    "tags": ["tag1"],
    "ingredients": [
      { "name": "ingredient", "quantity": "1", "unit": "cup", "section": "Produce" }
    ]
  }
]

Max 4 ingredients per recipe. calories/proteinGrams/carbGrams/fatGrams are per serving estimates. No extra fields. Start your response with [ and end with ].`;
  }

  async generateMealCategory(
    category: MealCategory,
    catalogRecipes: Recipe[],
    recentRecipeIds: string[],
    userPreferences?: string
  ): Promise<Recipe[]> {
    const prompt = this.buildGenerationPrompt(category, catalogRecipes, recentRecipeIds, userPreferences);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    try {
      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) {
        throw new Error('Response is not an array');
      }

      return parsed.map((item: any, index: number) => ({
        id: uuidv4(),
        name: item.name || `${category} recipe ${index + 1}`,
        category,
        subcategory: '',
        sourceUrl: item.sourceUrl || 'https://example.com',
        description: item.description || '',
        calories: item.calories,
        proteinGrams: item.proteinGrams,
        carbGrams: item.carbGrams,
        fatGrams: item.fatGrams,
        servings: item.servings,
        prepTime: item.prepTime,
        tags: item.tags || [],
        ingredients: (item.ingredients || []).map((ing: any) => ({
          name: ing.name,
          quantity: ing.quantity || '1',
          unit: ing.unit || 'unit',
          section: ing.section,
        })) as Ingredient[],
        savedAt: new Date().toISOString(),
        isFromCatalog: false,
        notes: '',
      })) as Recipe[];
    } catch (err) {
      console.error('Failed to parse Claude response:', err, content.text);
      throw new Error(`Failed to parse meal generation response: ${err}`);
    }
  }

  async extractRecipeFromUrl(url: string): Promise<Partial<Recipe>> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Extract recipe details from this URL and return ONLY valid JSON (no markdown):
${url}

Return this exact JSON structure:
{
  "name": "Recipe Name",
  "description": "1-2 sentence description",
  "proteinGrams": 25,
  "servings": 4,
  "prepTime": 30,
  "ingredients": [
    { "name": "ingredient", "quantity": "1", "unit": "cup", "section": "Produce" }
  ],
  "tags": ["tag1", "tag2"]
}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        name: parsed.name,
        description: parsed.description,
        proteinGrams: parsed.proteinGrams,
        servings: parsed.servings,
        prepTime: parsed.prepTime,
        sourceUrl: url,
        ingredients: parsed.ingredients,
        tags: parsed.tags || [],
      };
    } catch (err) {
      console.error('Failed to extract recipe:', err);
      throw new Error('Could not extract recipe from URL');
    }
  }

  async searchAndSelectRecipe(query: string, category: MealCategory): Promise<Partial<Recipe>> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: `Find a popular ${category} recipe matching: "${query}"
          
Return ONLY valid JSON (no markdown):
{
  "name": "Recipe Name",
  "description": "1-2 sentence description",
  "sourceName": "Website",
  "sourceUrl": "https://example.com/recipe",
  "proteinGrams": 25,
  "servings": 4,
  "prepTime": 30,
  "ingredients": [
    { "name": "ingredient", "quantity": "1", "unit": "cup", "section": "Produce" }
  ],
  "tags": ["tag1"]
}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response');
    }

    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        name: parsed.name,
        description: parsed.description,
        sourceUrl: parsed.sourceUrl,
        proteinGrams: parsed.proteinGrams,
        servings: parsed.servings,
        prepTime: parsed.prepTime,
        ingredients: parsed.ingredients,
        tags: parsed.tags,
      };
    } catch (err) {
      console.error('Failed to search recipe:', err);
      throw new Error('Could not find matching recipe');
    }
  }
}
