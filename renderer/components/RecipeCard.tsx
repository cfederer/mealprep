import React from 'react';
import { Recipe } from '../../shared/types';
import { CategoryBadge } from './CategoryBadge';

interface RecipeCardProps {
  recipe: Recipe;
  selected?: boolean;
  onSelect: () => void;
  onAddToCatalog?: () => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  selected = false,
  onSelect,
  onAddToCatalog,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
        selected ? 'border-blue-500 bg-blue-50 shadow-lg' : 'border-gray-200 hover:border-gray-400'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900 flex-1">{recipe.name}</h3>
        {selected && <span className="text-2xl">✓</span>}
      </div>

      {!recipe.isFromCatalog && (
        <span className="inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded mb-2 font-medium">
          ✨ New
        </span>
      )}

      <p className="text-sm text-gray-600 mb-2">{recipe.description}</p>

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <CategoryBadge category={recipe.category} />
        {recipe.proteinGrams && (
          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
            {recipe.proteinGrams}g protein
          </span>
        )}
      </div>

      {recipe.sourceUrl && (
        <div className="text-xs text-gray-500">
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {recipe.sourceUrl}
          </a>
        </div>
      )}

      {recipe.servings && (
        <div className="text-xs text-gray-600 mt-2">Servings: {recipe.servings}</div>
      )}

      {!recipe.isFromCatalog && onAddToCatalog && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToCatalog();
          }}
          className="mt-3 w-full text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 font-medium"
        >
          + Add to My Recipes
        </button>
      )}
    </div>
  );
};
