import { formatMlLabel } from '@/pages/Sell/sellNewFormUtils'

export const DEFAULT_BOTTLE_SIZES_ML = [250, 500, 1000] as const

const STORAGE_KEY = 'purchase:extraBottleSizesMl'

export function bottleRawMaterialCode(sizeMl: number): string {
  return `BOT-${sizeMl}ML`
}

export function bottleDisplayName(sizeMl: number): string {
  return `Bottle ${formatMlLabel(sizeMl)}`
}

export function loadExtraBottleSizesMl(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b)
  } catch {
    return []
  }
}

export function saveExtraBottleSizesMl(sizes: number[]): void {
  const unique = [...new Set(sizes)].sort((a, b) => a - b)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(unique))
}

export function parseCustomBottleSizeInput(input: string): number | null {
  const t = input.trim().toLowerCase().replace(/\s+/g, '')
  if (!t) return null
  const litres = t.match(/^(\d+(?:\.\d+)?)l$/)
  if (litres) return Math.round(Number(litres[1]) * 1000)
  const ml = t.match(/^(\d+(?:\.\d+)?)ml$/)
  if (ml) return Math.round(Number(ml[1]))
  const num = Number(t)
  if (Number.isFinite(num) && num > 0) return Math.round(num)
  return null
}

export function allBottleSizesMl(extra: number[]): number[] {
  const set = new Set<number>([...DEFAULT_BOTTLE_SIZES_ML, ...extra])
  return [...set].sort((a, b) => a - b)
}
