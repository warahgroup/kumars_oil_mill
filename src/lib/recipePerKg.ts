import type { Recipe } from '@/types/entities'

export function recipeBaseRawQty(recipe: Recipe): number {
  const base = Number(recipe.base_raw_qty)
  return base > 0 ? base : 1
}

/** Expected oil litres per 1 kg of base raw input. */
export function oilLitresPerKgInput(recipe: Recipe): number {
  return Number(recipe.expected_oil_litres) / recipeBaseRawQty(recipe)
}

/** Expected waste kg per 1 kg of base raw input. */
export function wasteKgPerKgInput(recipe: Recipe): number {
  return Number(recipe.expected_waste_kg) / recipeBaseRawQty(recipe)
}

export function ingredientQtyPerKgInput(ingredientQty: number, recipe: Recipe): number {
  return Number(ingredientQty) / recipeBaseRawQty(recipe)
}

export function expectedOutputForInputKg(
  recipe: Recipe,
  inputKg: number,
): { oilLitres: number; wasteKg: number } {
  const perKg = inputKg / recipeBaseRawQty(recipe)
  return {
    oilLitres: Number(recipe.expected_oil_litres) * perKg,
    wasteKg: Number(recipe.expected_waste_kg) * perKg,
  }
}
