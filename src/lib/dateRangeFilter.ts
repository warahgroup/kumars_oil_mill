export type PeriodFilter = 'day' | 'week' | 'month'

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Calendar date in the user's local timezone (`YYYY-MM-DD`). */
export function localIsoDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Inclusive date range for filtering `YYYY-MM-DD` strings. */
export function periodDateRange(period: PeriodFilter, anchor = new Date()): { from: string; to: string } {
  const end = startOfDay(anchor)
  const start = new Date(end)

  if (period === 'day') {
    return { from: localIsoDate(start), to: localIsoDate(end) }
  }

  if (period === 'week') {
    const day = end.getDay()
    const diffToMonday = day === 0 ? 6 : day - 1
    start.setDate(end.getDate() - diffToMonday)
    return { from: localIsoDate(start), to: localIsoDate(end) }
  }

  start.setDate(1)
  return { from: localIsoDate(start), to: localIsoDate(end) }
}

export function isDateInRange(isoDate: string, from: string, to: string): boolean {
  return isoDate >= from && isoDate <= to
}
