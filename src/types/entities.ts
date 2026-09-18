export type AccountType = 'cash' | 'upi' | 'bank'

export type RawMaterial = {
  id: string
  name: string
  code: string
  unit: string
  default_price: number
  shelf_life_days: number
  active: boolean
}

export type Product = {
  id: string
  name: string
  code: string
  unit: string
  retail_price: number
  wholesale_price: number
  active: boolean
  is_oil: boolean
  is_waste: boolean
}

export type ProductPackage = {
  id: string
  product_id: string
  label: string
  size_ml: number | null
  size_g: number | null
  packaging_cost: number
  active: boolean
}

export type Supplier = {
  id: string
  name: string
  phone: string | null
  address: string | null
  active: boolean
}

export type Customer = {
  id: string
  name: string
  phone: string | null
  address: string | null
  customer_type: string
  active: boolean
}

export type Recipe = {
  id: string
  name: string
  output_product_id: string
  base_raw_material_id: string
  base_raw_qty: number
  expected_oil_litres: number
  expected_waste_kg: number
  active: boolean
}

export type RecipeIngredient = {
  id: string
  recipe_id: string
  raw_material_id: string | null
  product_id: string | null
  quantity: number
  unit: string
}

export type FinancialAccount = {
  id: string
  name: string
  account_type: AccountType
  opening_balance: number
}

export type ExpenseCategory = {
  id: string
  name: string
  active: boolean
}

export type PurchaseBatch = {
  id: string
  batch_code: string
  raw_material_id: string
  original_quantity: number
  remaining_quantity: number
  purchase_date: string
  expiry_date: string
  unit_cost: number
}

export type ProductionBatch = {
  id: string
  output_product_id: string
  production_date: string
  expiry_date: string
  oil_output_litres: number
  waste_output_kg: number
  remaining_bulk_litres: number
  cost_per_litre: number
  effective_production_cost: number
}

export type StockMovement = {
  id: string
  movement_date: string
  direction: 'in' | 'out'
  item_type: 'raw_material' | 'bulk_oil' | 'packaged' | 'waste'
  product_id: string | null
  raw_material_id: string | null
  product_package_id: string | null
  purchase_batch_id: string | null
  production_batch_id: string | null
  quantity: number
  unit_cost: number
}
