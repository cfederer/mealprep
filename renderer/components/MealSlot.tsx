import React, { useState } from 'react';
import { MealCategory, SelectedMeal, Recipe } from '../../shared/types';
import { RecipeCard } from './RecipeCard';
import { usePlanStore } from '../store/planStore';

interface MealSlotProps {
  category: MealCategory;
  options: Recipe[];
  isLoading: boolean;
  selectedRecipeIds: string[];
  onRegenerateClick: () => void;
}

const defaultServings: Record<MealCategory, number> = {
  breakfast: 5,
  lunch: 5,
  dinner: 5,
  dessert: 2,
};

export const MealSlot: React.FC<MealSlotProps> = ({
  category,
  options,
  isLoading,
  selectedRecipeIds,
  onRegenerateClick,
}) => {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [customSearching, setCustomSearching] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [servingsOverride, setServingsOverride] = useState<Record<string, number>>({});

  const {
    selectBreakfast,
    selectLunch,
    selectDinner,
    selectDessert,
    deselectDinner,
    updateServings,
  } = usePlanStore();

  const handleSelectRecipe = (recipe: Recipe) => {
    const servings = servingsOverride[recipe.id] || defaultServings[category];
    const meal: SelectedMeal = {
      recipe,
      isCustomEntry: false,
      servingsNeeded: servings,
      selectedAt: new Date().toISOString(),
    };

    if (category === 'breakfast') selectBreakfast(meal);
    else if (category === 'lunch') selectLunch(meal);
    else if (category === 'dinner') selectDinner(meal);
    else if (category === 'dessert') selectDessert(meal);
  };

  const handleDeselectDinner = (recipeId: string) => {
    deselectDinner(recipeId);
  };

  const handleServingsChange = (recipeId: string, servings: number) => {
    setServingsOverride((prev) => ({ ...prev, [recipeId]: servings }));
    updateServings(category, recipeId, servings);
  };

  const isSelected = (recipeId: string): boolean => {
    return selectedRecipeIds.includes(recipeId);
  };

  const categoryLabel =
    category === 'breakfast'
      ? '🍳 Breakfast'
      : category === 'lunch'
        ? '🥗 Lunch'
        : category === 'dinner'
          ? '🍽️ Dinner (select 2-3)'
          : '🍫 Dessert (optional)';

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">{categoryLabel}</h2>
        {isLoading && <div className="text-sm text-blue-600">Generating...</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        {options.map((recipe) => (
          <div key={recipe.id}>
            <RecipeCard
              recipe={recipe}
              selected={isSelected(recipe.id)}
              onSelect={() => handleSelectRecipe(recipe)}
              onAddToCatalog={
                !recipe.isFromCatalog
                  ? () => window.mealPrepAPI.recipe.save({ ...recipe, isFromCatalog: true, savedAt: new Date().toISOString() })
                  : undefined
              }
            />
            {isSelected(recipe.id) && (
              <div className="mt-2 p-2 bg-blue-50 rounded border-l-2 border-blue-500">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Adjust servings? (default: {defaultServings[category]})
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={servingsOverride[recipe.id] || defaultServings[category]}
                  onChange={(e) => handleServingsChange(recipe.id, parseInt(e.target.value))}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
            )}
            {category === 'dinner' && isSelected(recipe.id) && (
              <button
                onClick={() => handleDeselectDinner(recipe.id)}
                className="mt-2 w-full px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
              >
                Remove from dinner
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-4 items-center">
        <button
          onClick={() => setShowCustomForm(!showCustomForm)}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-medium"
        >
          ✏️ Add my own idea
        </button>
        <button
          onClick={onRegenerateClick}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 text-sm font-medium"
        >
          🔄 Regenerate new ideas
        </button>
      </div>

      {showCustomForm && (
        <div className="mt-4 p-4 bg-gray-50 rounded border">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Recipe name or URL
          </label>
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="e.g. Chicken Stir Fry or https://example.com/recipe"
            className="w-full px-3 py-2 border rounded mb-2"
          />
          {customError && <p className="text-xs text-red-600 mb-2">{customError}</p>}
          <button
            disabled={customSearching || !customInput.trim()}
            onClick={async () => {
              setCustomSearching(true);
              setCustomError(null);
              try {
                const recipe = await window.mealPrepAPI.meals.searchRecipe(customInput.trim(), category);
                handleSelectRecipe(recipe);
                setShowCustomForm(false);
                setCustomInput('');
              } catch (err) {
                setCustomError('Could not find recipe. Try a different name or URL.');
              } finally {
                setCustomSearching(false);
              }
            }}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 text-sm font-medium"
          >
            {customSearching ? 'Searching...' : 'Add to plan'}
          </button>
        </div>
      )}
    </div>
  );
};
