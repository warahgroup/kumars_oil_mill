import { useBusinessSettings } from '@/hooks/useBusinessSettings'

type TopBarProps = {
  onOpenMenu: () => void
}

export function TopBar({ onOpenMenu }: TopBarProps) {
  const { state } = useBusinessSettings()
  const businessName =
    state.status === 'success' ? state.data.business_name : 'My Oil Mill'

  return (
    <header className="sticky top-0 z-20 border-b border-brand-100 bg-brand-900/95 backdrop-blur md:hidden">
      <div className="flex items-center gap-3 px-3 py-3">
        <button
          type="button"
          aria-label="Open menu"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-surface-elevated text-lg font-bold text-slate-100"
          onClick={onOpenMenu}
        >
          ☰
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-accent-400">Menu</p>
          <h1 className="truncate text-lg font-bold text-slate-100">{businessName}</h1>
        </div>
        <span className="shrink-0 rounded-full bg-accent-400 px-2.5 py-1 text-[10px] font-bold text-brand-900">
          Oil Mill
        </span>
      </div>
    </header>
  )
}
