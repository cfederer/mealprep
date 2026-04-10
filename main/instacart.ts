import { WeeklyPlan, SelectedMeal, Ingredient } from '../shared/types';

const INSTACART_API_BASE = 'https://connect.instacart.com';

export interface InstacartLineItem {
  name: string;
  quantity: number;
  unit: string | null;
  display_text: string;
}

export async function buildShoppingLink(plan: WeeklyPlan, apiKey: string): Promise<string> {
  const meals: SelectedMeal[] = [
    ...(plan.breakfast ? [plan.breakfast] : []),
    ...(plan.lunch ? [plan.lunch] : []),
    ...(plan.dinner || []),
  ];

  // Collect and deduplicate ingredients across all selected meals
  const ingredientMap = new Map<string, InstacartLineItem>();

  for (const meal of meals) {
    const ingredients: Ingredient[] = Array.isArray(meal.recipe.ingredients)
      ? meal.recipe.ingredients
      : [];

    for (const ing of ingredients) {
      const key = ing.name.trim().toLowerCase();
      if (!key) continue;

      const qty = parseFloat(ing.quantity) || 1;
      const unit = ing.unit?.trim() || null;

      if (ingredientMap.has(key)) {
        const existing = ingredientMap.get(key)!;
        // Sum quantities if same unit, otherwise keep first
        if (existing.unit === unit) {
          existing.quantity += qty;
          existing.display_text = formatDisplayText(ing.name, existing.quantity, unit);
        }
      } else {
        ingredientMap.set(key, {
          name: ing.name.trim(),
          quantity: qty,
          unit,
          display_text: formatDisplayText(ing.name, qty, unit),
        });
      }
    }
  }

  const lineItems = Array.from(ingredientMap.values());

  if (lineItems.length === 0) {
    throw new Error('No ingredients found in selected meals');
  }

  const title = `Weekly Meal Prep for ${plan.weekStartDate}`;

  const response = await fetch(`${INSTACART_API_BASE}/idp/v1/products/products_link`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      title,
      link_type: 'shopping_list',
      expires_in: 7,
      line_items: lineItems,
      landing_page_configuration: {
        enable_pantry_items: false,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Instacart API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  if (!data.products_link_url) {
    throw new Error('Instacart response missing products_link_url');
  }
  return data.products_link_url as string;
}

function formatDisplayText(name: string, quantity: number, unit: string | null): string {
  const qty = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1);
  return unit ? `${qty} ${unit} ${name}` : `${qty} ${name}`;
}
