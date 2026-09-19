import { localIsoDate, periodDateRange } from '@/lib/dateRangeFilter'

export type ReportDatePreset = 'today' | 'yesterday' | 'last7' | 'month' | 'custom'

export type ReportDateRange = {
  preset: ReportDatePreset
  from: string
  to: string
  label: string
}

export function resolveReportDateRange(
  preset: ReportDatePreset,
  customFrom?: string,
  customTo?: string,
): ReportDateRange {
  if (preset === 'today') {
    const { from, to } = periodDateRange('day')
    return { preset, from, to, label: 'Today' }
  }
  if (preset === 'yesterday') {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const iso = localIsoDate(d)
    return { preset, from: iso, to: iso, label: 'Yesterday' }
  }
  if (preset === 'last7') {
    const end = new Date()
    end.setHours(0, 0, 0, 0)
    const start = new Date(end)
    start.setDate(end.getDate() - 6)
    return {
      preset,
      from: localIsoDate(start),
      to: localIsoDate(end),
      label: 'Last 7 days',
    }
  }
  if (preset === 'month') {
    const { from, to } = periodDateRange('month')
    return { preset, from, to, label: 'This month' }
  }
  const from = customFrom ?? localIsoDate()
  const to = customTo ?? from
  return { preset, from, to, label: `${from} – ${to}` }
}
