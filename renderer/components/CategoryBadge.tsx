import React from 'react';
import { MealCategory } from '../../shared/types';

interface CategoryBadgeProps {
  category: MealCategory;
}

const categoryStyles: Record<MealCategory, { bg: string; icon: string }> = {
  breakfast: { bg: 'bg-orange-100 text-orange-800', icon: '🍳' },
  lunch: { bg: 'bg-green-100 text-green-800', icon: '🥗' },
  dinner: { bg: 'bg-blue-100 text-blue-800', icon: '🍽️' },
  dessert: { bg: 'bg-pink-100 text-pink-800', icon: '🍫' },
};

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category }) => {
  const style = categoryStyles[category];
  const label =
    category === 'breakfast'
      ? 'Breakfast'
      : category === 'lunch'
        ? 'Lunch'
        : category === 'dinner'
          ? 'Dinner'
          : 'Dessert';

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${style.bg}`}>
      {style.icon} {label}
    </span>
  );
};
