import React, { useEffect, useState } from 'react';
import { MealSlotOptions, Recipe } from '../../shared/types';
import { MealSlot } from '../components/MealSlot';
import { SettingsPage } from './SettingsPage';
import { MealPrepAPI } from '../api/types';
import { usePlanStore } from '../store/planStore';

export const WeeklyPlanner: React.FC = () => {
  const [mealOptions, setMealOptions] = useState<{
    breakfast: MealSlotOptions | null;
    lunch: MealSlotOptions | null;
    dinner: MealSlotOptions | null;
  }>({
    breakfast: null,
    lunch: null,
    dinner: null,
  });

  const [loadingCategory, setLoadingCategory] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const { currentPlan, setLoading, setError } = usePlanStore();

  useEffect(() => {
    loadRecipes();
    checkApiKey();
  }, []);

  const loadRecipes = async () => {
    try {
      const loaded = await window.mealPrepAPI.recipes.getAll();
      setRecipes(loaded);
    } catch (err) {
      console.error('Failed to load recipes:', err);
      setError('Failed to load recipes');
    }
  };

  const checkApiKey = async () => {
    try {
      const has = await window.mealPrepAPI.settings.hasClaudeApiKey();
      setHasApiKey(has);
    } catch (err) {
      console.warn('Could not check API key:', err);
      setHasApiKey(false);
    }
  };

  const handleGenerateMeals = async () => {
    if (!hasApiKey) {
      setShowSettings(true);
      setError('Please configure your Claude API key in Settings first');
      return;
    }

    setLoading(true);
    setIsGenerating(true);
    try {
      const generated = await window.mealPrepAPI.meals.generate();
      setMealOptions(generated);
    } catch (err) {
      console.error('Failed to generate meals:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate meals');
    } finally {
      setLoading(false);
      setIsGenerating(false);
    }
  };

  const handleRegenerateCategory = async (category: string) => {
    setLoadingCategory(category);
    try {
      const result = await window.mealPrepAPI.meals.generateCategory(category);
      setMealOptions((prev) => ({ ...prev, [category]: result }));
    } catch (err) {
      console.error('Failed to regenerate category:', err);
    } finally {
      setLoadingCategory(null);
    }
  };

  const getSelectedRecipeIds = (category: string): string[] => {
    if (category === 'breakfast' && currentPlan?.breakfast) {
      return [currentPlan.breakfast.recipe.id];
    }
    if (category === 'lunch' && currentPlan?.lunch) {
      return [currentPlan.lunch.recipe.id];
    }
    if (category === 'dinner' && currentPlan?.dinner) {
      return currentPlan.dinner.map((m) => m.recipe.id);
    }
    if (category === 'dessert' && currentPlan?.dessert) {
      return [currentPlan.dessert.recipe.id];
    }
    return [];
  };

  const handleSendToInstacart = async () => {
    if (!currentPlan) return;

    try {
      setLoading(true);
      const result = await window.mealPrepAPI.plan.save(currentPlan);
      if (result?.success) {
        const location = result.fileUrl
          ? `Saved to Google Drive:\nMealPrep / Weekly Meal Prep for ${currentPlan.weekStartDate}`
          : 'Saved locally.';
        alert(`Plan saved! 🎉\n\n${location}`);
      } else {
        alert('Failed to save plan');
      }
    } catch (err) {
      console.error('Error saving plan:', err);
      alert('Error saving plan');
    } finally {
      setLoading(false);
    }
  };

  const handleClearPlan = () => {
    if (window.confirm('Clear the current meal plan?')) {
      const { clearPlan } = usePlanStore.getState();
      clearPlan();
    }
  };

  const hasAnySelection =
    currentPlan?.breakfast || currentPlan?.lunch || currentPlan?.dinner.length || currentPlan?.dessert;

  if (showSettings) {
    return (
      <SettingsPage
        onClose={() => {
          setShowSettings(false);
          checkApiKey();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Weekly Meal Planner</h1>
            <p className="text-gray-600">
              Week of {currentPlan?.weekStartDate}
            </p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold"
          >
            ⚙️ Settings
          </button>
        </div>

        {!hasApiKey && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
            <strong>⚠️ API Key Required:</strong> Please configure your Claude API key in Settings to generate meals.
          </div>
        )}

        <div className="flex gap-4 mb-8 flex-wrap">
          <button
            onClick={handleGenerateMeals}
            disabled={!hasApiKey || isGenerating}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Generating... (~45s)
              </>
            ) : (
              <>🎲 Generate My Week</>
            )}
          </button>
          <button
            onClick={handleClearPlan}
            className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold"
          >
            🔄 Clear Plan
          </button>
          <button
            onClick={handleSendToInstacart}
            disabled={!hasAnySelection}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold"
          >
            💾 Save Plan →
          </button>
        </div>

        {mealOptions.breakfast && (
          <MealSlot
            category="breakfast"
            options={mealOptions.breakfast.options}
            isLoading={loadingCategory === 'breakfast'}
            selectedRecipeIds={getSelectedRecipeIds('breakfast')}
            onRegenerateClick={() => handleRegenerateCategory('breakfast')}
          />
        )}

        {mealOptions.lunch && (
          <MealSlot
            category="lunch"
            options={mealOptions.lunch.options}
            isLoading={loadingCategory === 'lunch'}
            selectedRecipeIds={getSelectedRecipeIds('lunch')}
            onRegenerateClick={() => handleRegenerateCategory('lunch')}
          />
        )}

        {mealOptions.dinner && (
          <MealSlot
            category="dinner"
            options={mealOptions.dinner.options}
            isLoading={loadingCategory === 'dinner'}
            selectedRecipeIds={getSelectedRecipeIds('dinner')}
            onRegenerateClick={() => handleRegenerateCategory('dinner')}
          />
        )}


        {!mealOptions.breakfast && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Click "Generate My Week" to see meal options</p>
            <p className="text-sm mt-2">First time? Start by configuring your Claude API key in Settings.</p>
          </div>
        )}
      </div>
    </div>
  );
};
