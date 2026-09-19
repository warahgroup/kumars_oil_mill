import { supabase } from '@/lib/supabase'
import { recordProduction } from '@/services/transactionService'
import { createIdempotencyKey } from '@/lib/idempotency'
import { listRecipeIngredients } from '@/services/masterDataService'
import type { Recipe } from '@/types/entities'
import { simulateFefoRawCost } from '@/services/stockService'

export type ProductionListRow = {
  id: string
  production_date: string
  oil_output_litres: number
  waste_output_kg: number
  cost_per_litre: number
  effective_production_cost: number
  expiry_date: string
  product?: { name: string } | null
}

export async function listProductions(): Promise<ProductionListRow[]> {
  const { data, error } = await supabase
    .from('production_batches')
    .select(
      'id, production_date, oil_output_litres, waste_output_kg, cost_per_litre, effective_production_cost, expiry_date, product:products(name)',
    )
    .order('production_date', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as unknown as ProductionListRow[]
}

export async function estimateProductionCost(
  recipe: Recipe,
  inputQtyKg: number,
): Promise<{ oilOut: number; wasteOut: number; estimatedCost: number; costPerLitre: number }> {
  const scale = inputQtyKg / Number(recipe.base_raw_qty)
  const oilOut = Number(recipe.expected_oil_litres) * scale
  const wasteOut = Number(recipe.expected_waste_kg) * scale
  const ingredients = await listRecipeIngredients(recipe.id)

  let rawCost = 0
  for (const ing of ingredients) {
    if (!ing.raw_material_id) continue
    const need = Number(ing.quantity) * (oilOut / Number(recipe.expected_oil_litres))
    rawCost += await simulateFefoRawCost(ing.raw_material_id, need)
  }

  const estimatedCost = rawCost
  const costPerLitre = oilOut > 0 ? estimatedCost / oilOut : 0
  return { oilOut, wasteOut, estimatedCost, costPerLitre }
}

export type SaveProductionInput = {
  recipe_id: string
  input_qty: number
  recipe: Recipe
  oil_output_litres: number
  waste_output_kg: number
  production_date: string
  expiry_date: string
  labour_cost?: number
  electricity_cost?: number
  overhead_cost?: number
  waste_value?: number
}

export async function saveProduction(input: SaveProductionInput): Promise<string> {
  return recordProduction({
    recipe_id: input.recipe_id,
    oil_output_litres: input.oil_output_litres,
    waste_output_kg: input.waste_output_kg,
    production_date: input.production_date,
    expiry_date: input.expiry_date,
    labour_cost: input.labour_cost ?? 0,
    electricity_cost: input.electricity_cost ?? 0,
    overhead_cost: input.overhead_cost ?? 0,
    waste_value: input.waste_value ?? 0,
    idempotency_key: createIdempotencyKey('production'),
  })
}
