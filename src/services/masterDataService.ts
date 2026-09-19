import { bottleDisplayName, bottleRawMaterialCode } from '@/lib/bottlePurchaseSizes'
import { cachedQuery, invalidateDataCache } from '@/lib/dataCache'
import { supabase } from '@/lib/supabase'
import type {
  Customer,
  ExpenseCategory,
  Product,
  ProductPackage,
  RawMaterial,
  Recipe,
  RecipeIngredient,
  Supplier,
} from '@/types/entities'

export async function listRawMaterials(): Promise<RawMaterial[]> {
  return cachedQuery('master:materials', () => listRawMaterialsUncached())
}

async function listRawMaterialsUncached(): Promise<RawMaterial[]> {
  const { data, error } = await supabase
    .from('raw_materials')
    .select('id, name, code, unit, default_price, shelf_life_days, active')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as RawMaterial[]
}

export async function listProducts(): Promise<Product[]> {
  return cachedQuery('master:products', () => listProductsUncached())
}

async function listProductsUncached(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, code, unit, retail_price, wholesale_price, active, is_oil, is_waste')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as Product[]
}

export async function listProductPackages(): Promise<ProductPackage[]> {
  return cachedQuery('master:packages', () => listProductPackagesUncached())
}

async function listProductPackagesUncached(): Promise<ProductPackage[]> {
  const { data, error } = await supabase
    .from('product_packages')
    .select('id, product_id, label, size_ml, size_g, packaging_cost, active')
    .eq('active', true)
    .order('label')
  if (error) throw error
  return (data ?? []) as ProductPackage[]
}

export async function listSuppliers(): Promise<Supplier[]> {
  return cachedQuery('master:suppliers', () => listSuppliersUncached())
}

async function listSuppliersUncached(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, phone, address, active')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as Supplier[]
}

export async function createSupplier(name: string, phone?: string): Promise<Supplier> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ user_id: user.id, name, phone: phone ?? null })
    .select('id, name, phone, address, active')
    .single()
  if (error) throw error
  return data as Supplier
}

export async function listCustomers(search?: string): Promise<Customer[]> {
  if (search?.trim()) {
    return listCustomersUncached(search)
  }
  return cachedQuery('master:customers', () => listCustomersUncached())
}

async function listCustomersUncached(search?: string): Promise<Customer[]> {
  let q = supabase
    .from('customers')
    .select('id, name, phone, address, customer_type, active')
    .eq('active', true)
    .order('name')
  if (search?.trim()) {
    q = q.or(`name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`)
  }
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Customer[]
}

export async function upsertCustomer(input: {
  id?: string
  name: string
  phone?: string
  address?: string
  customer_type?: string
}): Promise<Customer> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  if (input.id) {
    const { data, error } = await supabase
      .from('customers')
      .update({
        name: input.name,
        phone: input.phone ?? null,
        address: input.address ?? null,
        customer_type: input.customer_type ?? 'retail',
      })
      .eq('id', input.id)
      .select('id, name, phone, address, customer_type, active')
      .single()
    if (error) throw error
    invalidateDataCache('master:customers')
    return data as Customer
  }

  const { data, error } = await supabase
    .from('customers')
    .insert({
      user_id: user.id,
      name: input.name,
      phone: input.phone ?? null,
      address: input.address ?? null,
      customer_type: input.customer_type ?? 'retail',
    })
    .select('id, name, phone, address, customer_type, active')
    .single()
  if (error) throw error
  invalidateDataCache('master:customers')
  return data as Customer
}

export async function listRecipes(): Promise<Recipe[]> {
  return cachedQuery('master:recipes', () => listRecipesUncached())
}

async function listRecipesUncached(): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select(
      'id, name, output_product_id, base_raw_material_id, base_raw_qty, expected_oil_litres, expected_waste_kg, active',
    )
    .eq('active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as Recipe[]
}

export async function listRecipeIngredients(recipeId: string): Promise<RecipeIngredient[]> {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select('id, recipe_id, raw_material_id, product_id, quantity, unit')
    .eq('recipe_id', recipeId)
  if (error) throw error
  return (data ?? []) as RecipeIngredient[]
}

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  const { data, error } = await supabase
    .from('expense_categories')
    .select('id, name, active')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as ExpenseCategory[]
}

export async function updateProduct(
  id: string,
  patch: Partial<Pick<Product, 'name' | 'retail_price' | 'wholesale_price' | 'active'>>,
): Promise<void> {
  const { error } = await supabase.from('products').update(patch).eq('id', id)
  if (error) throw error
}

export async function updateRawMaterial(
  id: string,
  patch: Partial<Pick<RawMaterial, 'name' | 'default_price' | 'shelf_life_days' | 'active'>>,
): Promise<void> {
  const { error } = await supabase.from('raw_materials').update(patch).eq('id', id)
  if (error) throw error
  invalidateDataCache('master:materials')
}

function rawMaterialCodePrefix(category: 'raw' | 'bottle' | 'package'): string {
  if (category === 'bottle') return 'BOT-'
  if (category === 'package') return 'PKG-'
  return 'RM-'
}

function uniqueMaterialCode(prefix: string, name: string): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 14)
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}${slug || 'ITEM'}-${suffix}`
}

export async function createRawMaterial(input: {
  name: string
  default_price: number
  category: 'raw' | 'bottle' | 'package'
  unit?: string
  description?: string
  fixedCode?: string
}): Promise<RawMaterial> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const prefix = rawMaterialCodePrefix(input.category)
  const unit =
    input.unit ??
    (input.category === 'raw' ? 'kg' : 'pcs')
  const displayName = input.description?.trim()
    ? `${input.name.trim()} — ${input.description.trim()}`
    : input.name.trim()
  if (!displayName) throw new Error('Please enter a name.')

  const { data, error } = await supabase
    .from('raw_materials')
    .insert({
      user_id: user.id,
      name: displayName,
      code: input.fixedCode ?? uniqueMaterialCode(prefix, input.name),
      unit,
      default_price: input.default_price,
      shelf_life_days: input.category === 'raw' ? 180 : 3650,
    })
    .select('id, name, code, unit, default_price, shelf_life_days, active')
    .single()
  if (error) throw error
  invalidateDataCache('master:materials')
  return data as RawMaterial
}

export async function getOrCreateBottleRawMaterial(
  sizeMl: number,
  defaultPrice = 0,
): Promise<RawMaterial> {
  const code = bottleRawMaterialCode(sizeMl)
  const existing = (await listRawMaterials()).find((m) => m.code.toUpperCase() === code.toUpperCase())
  if (existing) return existing
  return createRawMaterial({
    name: bottleDisplayName(sizeMl),
    default_price: defaultPrice,
    category: 'bottle',
    unit: 'pcs',
    fixedCode: code,
  })
}

export async function updateProductPackage(
  id: string,
  patch: Partial<Pick<ProductPackage, 'label' | 'packaging_cost' | 'active'>>,
): Promise<void> {
  const { error } = await supabase.from('product_packages').update(patch).eq('id', id)
  if (error) throw error
}

export async function updateRecipe(
  id: string,
  patch: Partial<
    Pick<Recipe, 'name' | 'expected_oil_litres' | 'expected_waste_kg' | 'base_raw_qty' | 'active'>
  >,
): Promise<void> {
  const { error } = await supabase.from('recipes').update(patch).eq('id', id)
  if (error) throw error
}

export async function updateBusinessSettings(patch: {
  business_name?: string
  expiry_alert_days?: number[]
  profit_target_percent?: number | null
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase.from('business_settings').update(patch).eq('user_id', user.id)
  if (error) throw error
}

export async function getBusinessSettings() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('business_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw error
  return data
}
