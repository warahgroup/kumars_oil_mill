export function formatCustomerAddress(shopName: string, area: string): string {
  const shop = shopName.trim()
  const loc = area.trim()
  if (shop && loc) return `Shop: ${shop}\n${loc}`
  if (shop) return `Shop: ${shop}`
  return loc
}

export function parseCustomerAddress(address: string | null): { shopName: string; area: string } {
  if (!address) return { shopName: '', area: '' }
  const lines = address.split('\n')
  const first = lines[0] ?? ''
  if (first.startsWith('Shop: ')) {
    return { shopName: first.slice(6), area: lines.slice(1).join('\n') }
  }
  return { shopName: '', area: address }
}
