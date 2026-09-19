import type { RawMaterial } from '@/types/entities'

export type PurchaseCategory = 'raw' | 'bottle' | 'package'

export function purchaseCategoryFromCode(code: string): PurchaseCategory {
  const c = code.toUpperCase()
  if (c.startsWith('BOT-')) return 'bottle'
  if (c.startsWith('PKG-')) return 'package'
  return 'raw'
}

export function purchaseCategoryLabel(cat: PurchaseCategory): string {
  if (cat === 'bottle') return 'Bottles'
  if (cat === 'package') return 'Packages'
  return 'Raw materials'
}

export function filterMaterialsByCategory(
  materials: RawMaterial[],
  category: PurchaseCategory,
): RawMaterial[] {
  return materials.filter((m) => purchaseCategoryFromCode(m.code) === category)
}
