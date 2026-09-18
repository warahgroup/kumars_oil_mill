import type { Product, ProductPackage } from '@/types/entities'

export const OIL_PACKAGE_SIZES_ML = [100, 250, 500, 1000] as const
export const POWDER_PACKAGE_SIZES_G = [100, 250, 500, 1000] as const

export type PackageSelection =
  | { mode: 'packaged_ml'; sizeMl: number }
  | { mode: 'custom_litres' }
  | { mode: 'packaged_g'; sizeG: number }
  | { mode: 'custom_grams' }

export function isPowderProduct(product: Product): boolean {
  if (product.is_waste || product.is_oil) return false
  const code = product.code.toUpperCase()
  const name = product.name.toLowerCase()
  return code.endsWith('PWD') || name.includes('powder') || name.includes('jaggery')
}

export function findPackageByMl(packages: ProductPackage[], sizeMl: number): ProductPackage | undefined {
  return packages.find((p) => p.size_ml === sizeMl)
}

export function findPackageByG(packages: ProductPackage[], sizeG: number): ProductPackage | undefined {
  return packages.find((p) => p.size_g === sizeG)
}

export function formatMlLabel(sizeMl: number): string {
  if (sizeMl >= 1000) return `${sizeMl / 1000} L`
  return `${sizeMl} ml`
}

export function formatGLabel(sizeG: number): string {
  if (sizeG >= 1000) return `${sizeG / 1000} kg`
  return `${sizeG} g`
}

export function defaultPackageSelection(product: Product): PackageSelection {
  if (product.is_oil) return { mode: 'packaged_ml', sizeMl: 500 }
  if (isPowderProduct(product)) return { mode: 'packaged_g', sizeG: 500 }
  return { mode: 'packaged_ml', sizeMl: 500 }
}

export function packageSelectionLabel(
  selection: PackageSelection,
  packages: ProductPackage[],
): string {
  if (selection.mode === 'custom_litres') return 'Custom (litres)'
  if (selection.mode === 'custom_grams') return 'Custom (grams)'
  if (selection.mode === 'packaged_ml') {
    const pkg = findPackageByMl(packages, selection.sizeMl)
    return pkg?.label ?? formatMlLabel(selection.sizeMl)
  }
  const pkg = findPackageByG(packages, selection.sizeG)
  return pkg?.label ?? formatGLabel(selection.sizeG)
}
