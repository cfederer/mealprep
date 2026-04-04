import { create } from 'zustand';
import { WeeklyPlan, MealSlotOptions, SelectedMeal } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

interface PlanStore {
  currentPlan: WeeklyPlan | null;
  mealOptions: {
    breakfast: MealSlotOptions | null;
    lunch: MealSlotOptions | null;
    dinner: MealSlotOptions | null;
    dessert: MealSlotOptions | null;
  };
  isLoading: boolean;
  error: string | null;

  // Actions
  setCurrentPlan: (plan: WeeklyPlan) => void;
  setMealOptions: (category: string, options: MealSlotOptions) => void;
  selectBreakfast: (meal: SelectedMeal) => void;
  selectLunch: (meal: SelectedMeal) => void;
  selectDinner: (meal: SelectedMeal) => void;
  deselectDinner: (recipeId: string) => void;
  selectDessert: (meal: SelectedMeal | null) => void;
  updateServings: (category: string, recipeId: string, servings: number) => void;
  clearPlan: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const usePlanStore = create<PlanStore>((set) => {
  const initialPlan: WeeklyPlan = {
    id: uuidv4(),
    weekStartDate: new Date().toISOString().slice(0, 10),
    breakfast: undefined,
    lunch: undefined,
    dinner: [],
    dessert: undefined,
  };

  return {
    currentPlan: initialPlan,
    mealOptions: {
      breakfast: null,
      lunch: null,
      dinner: null,
      dessert: null,
    },
    isLoading: false,
    error: null,

    setCurrentPlan: (plan) => set({ currentPlan: plan }),

    setMealOptions: (category, options) =>
      set((state) => ({
        mealOptions: {
          ...state.mealOptions,
          [category]: options,
        },
      })),

    selectBreakfast: (meal) =>
      set((state) => ({
        currentPlan: state.currentPlan
          ? { ...state.currentPlan, breakfast: meal }
          : null,
      })),

    selectLunch: (meal) =>
      set((state) => ({
        currentPlan: state.currentPlan
          ? { ...state.currentPlan, lunch: meal }
          : null,
      })),

    selectDinner: (meal) =>
      set((state) => {
        if (!state.currentPlan) return { currentPlan: null };
        const existing = state.currentPlan.dinner || [];
        // Prevent duplicate selection (by recipe ID)
        if (existing.some((m) => m.recipe.id === meal.recipe.id)) {
          return { currentPlan: state.currentPlan };
        }
        // Allow up to 3 dinner selections
        if (existing.length >= 3) {
          return { currentPlan: state.currentPlan };
        }
        return {
          currentPlan: {
            ...state.currentPlan,
            dinner: [...existing, meal],
          },
        };
      }),

    deselectDinner: (recipeId) =>
      set((state) => ({
        currentPlan: state.currentPlan
          ? {
              ...state.currentPlan,
              dinner: (state.currentPlan.dinner || []).filter(
                (m) => m.recipe.id !== recipeId
              ),
            }
          : null,
      })),

    selectDessert: (meal) =>
      set((state) => ({
        currentPlan: state.currentPlan
          ? { ...state.currentPlan, dessert: meal ?? undefined }
          : null,
      })),

    updateServings: (category, recipeId, servings) =>
      set((state) => {
        if (!state.currentPlan) return { currentPlan: null };
        const plan = { ...state.currentPlan };

        if (category === 'breakfast' && plan.breakfast?.recipe.id === recipeId) {
          plan.breakfast = { ...plan.breakfast, servingsNeeded: servings };
        } else if (category === 'lunch' && plan.lunch?.recipe.id === recipeId) {
          plan.lunch = { ...plan.lunch, servingsNeeded: servings };
        } else if (category === 'dinner') {
          plan.dinner = (plan.dinner || []).map((m) =>
            m.recipe.id === recipeId ? { ...m, servingsNeeded: servings } : m
          );
        } else if (category === 'dessert' && plan.dessert?.recipe.id === recipeId) {
          plan.dessert = { ...plan.dessert, servingsNeeded: servings };
        }

        return { currentPlan: plan };
      }),

    clearPlan: () => {
      const newPlan: WeeklyPlan = {
        id: uuidv4(),
        weekStartDate: new Date().toISOString().slice(0, 10),
        breakfast: undefined,
        lunch: undefined,
        dinner: [],
        dessert: undefined,
      };
      set({ currentPlan: newPlan });
    },

    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
  };
});
