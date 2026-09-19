export const CRUSHING_RAW_CODES = ['SES-SEED', 'GND-NUT', 'COC-NUT'] as const

/** Internal customer row for crushing jobs (no shop picker in UI). */
export const CRUSHING_WALK_IN_CUSTOMER_NAME = 'Crushing (walk-in)'

export type CrushingSettings = {
  charge_per_kg_by_raw_code: Record<string, number>
  cake_rate_by_product_code: Record<string, number>
}

export const DEFAULT_CRUSHING_SETTINGS: CrushingSettings = {
  charge_per_kg_by_raw_code: { 'SES-SEED': 15, 'GND-NUT': 15, 'COC-NUT': 12 },
  cake_rate_by_product_code: { 'SES-CAKE': 25, 'GND-CAKE': 20, 'COC-CAKE': 15 },
}

export function cakeProductCodeForRaw(rawCode: string): string | null {
  const map: Record<string, string> = {
    'SES-SEED': 'SES-CAKE',
    'GND-NUT': 'GND-CAKE',
    'COC-NUT': 'COC-CAKE',
  }
  return map[rawCode] ?? null
}

export function computeCrushingSettlement(
  inputKg: number,
  crushingRatePerKg: number,
  cakeKg: number,
  cakeHandling: 'customer_takes' | 'sell_to_mill',
  cakeRatePerKg: number,
): {
  crushingCharge: number
  cakeValue: number
  net: number
  direction: 'customer_pays_mill' | 'mill_pays_customer' | 'settled'
} {
  const crushingCharge = Math.round(inputKg * crushingRatePerKg * 100) / 100
  const cakeValue =
    cakeHandling === 'sell_to_mill' ? Math.round(cakeKg * cakeRatePerKg * 100) / 100 : 0
  const net = Math.round((crushingCharge - cakeValue) * 100) / 100
  let direction: 'customer_pays_mill' | 'mill_pays_customer' | 'settled' = 'settled'
  if (net > 0) direction = 'customer_pays_mill'
  if (net < 0) direction = 'mill_pays_customer'
  return { crushingCharge, cakeValue, net: Math.abs(net), direction }
}
