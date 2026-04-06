import React from 'react';
import { WeeklyPlan, SelectedMeal } from '../../shared/types';

interface MacroSummaryProps {
  plan: WeeklyPlan;
}

interface MacroTotals {
  calories: number | null;
  proteinGrams: number | null;
  carbGrams: number | null;
  fatGrams: number | null;
}

function getMacrosPerServing(meal: SelectedMeal): MacroTotals | null {
  const r = meal.recipe;
  const servings = r.servings || 1;
  const eaten = meal.servingsNeeded || 1;
  // Scale: if recipe makes 5 servings and you're eating 1, multiply by 1/5
  const scale = eaten / servings;

  const hasAny = r.calories != null || r.proteinGrams != null || r.carbGrams != null || r.fatGrams != null;
  if (!hasAny) return null;

  return {
    calories: r.calories != null ? Math.round(r.calories * scale) : null,
    proteinGrams: r.proteinGrams != null ? Math.round(r.proteinGrams * scale) : null,
    carbGrams: r.carbGrams != null ? Math.round(r.carbGrams * scale) : null,
    fatGrams: r.fatGrams != null ? Math.round(r.fatGrams * scale) : null,
  };
}

function addMacros(a: MacroTotals, b: MacroTotals): MacroTotals {
  return {
    calories: a.calories != null && b.calories != null ? a.calories + b.calories
              : a.calories ?? b.calories,
    proteinGrams: a.proteinGrams != null && b.proteinGrams != null ? a.proteinGrams + b.proteinGrams
                  : a.proteinGrams ?? b.proteinGrams,
    carbGrams: a.carbGrams != null && b.carbGrams != null ? a.carbGrams + b.carbGrams
               : a.carbGrams ?? b.carbGrams,
    fatGrams: a.fatGrams != null && b.fatGrams != null ? a.fatGrams + b.fatGrams
              : a.fatGrams ?? b.fatGrams,
  };
}

const fmt = (val: number | null, unit: string) =>
  val != null ? `${val}${unit}` : '—';

export const MacroSummary: React.FC<MacroSummaryProps> = ({ plan }) => {
  const meals: SelectedMeal[] = [
    ...(plan.breakfast ? [plan.breakfast] : []),
    ...(plan.lunch ? [plan.lunch] : []),
    ...(plan.dinner || []),
  ];

  if (meals.length === 0) return null;

  const totals = meals.reduce<MacroTotals>(
    (acc, meal) => {
      const m = getMacrosPerServing(meal);
      if (!m) return acc;
      return addMacros(acc, m);
    },
    { calories: null, proteinGrams: null, carbGrams: null, fatGrams: null }
  );

  const hasAnyData = totals.calories != null || totals.proteinGrams != null ||
                     totals.carbGrams != null || totals.fatGrams != null;

  const dinnerCount = (plan.dinner || []).length;
  const note = dinnerCount > 1
    ? `Daily total assumes 1 serving of each selected item. Dinner macros include all ${dinnerCount} selected dinners — divide by ${dinnerCount} for a single-night estimate.`
    : 'Daily total assumes 1 serving of each selected item.';

  return (
    <div className="mb-8 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      <h2 className="text-lg font-bold text-gray-900 mb-3">Daily Macro Estimate</h2>
      {hasAnyData ? (
        <>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{fmt(totals.calories, '')}</div>
              <div className="text-xs text-gray-500 mt-1">Calories</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{fmt(totals.proteinGrams, 'g')}</div>
              <div className="text-xs text-gray-500 mt-1">Protein</div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{fmt(totals.carbGrams, 'g')}</div>
              <div className="text-xs text-gray-500 mt-1">Carbs</div>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{fmt(totals.fatGrams, 'g')}</div>
              <div className="text-xs text-gray-500 mt-1">Fat</div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">{note}</p>
          {meals.some((m) => getMacrosPerServing(m) === null) && (
            <p className="text-xs text-gray-400 mt-1">
              Some selected recipes don't have macro data and are excluded from totals.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-500">
          No macro data available for selected recipes. Macro estimates are included for AI-generated recipes.
        </p>
      )}
    </div>
  );
};
