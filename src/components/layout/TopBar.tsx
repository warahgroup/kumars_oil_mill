import { useBusinessSettings } from '@/hooks/useBusinessSettings'

export function TopBar() {
  const { state } = useBusinessSettings()
  const businessName =
    state.status === 'success' ? state.data.business_name : 'My Oil Mill'

  return (
    <header className="sticky top-0 z-20 border-b border-brand-100 bg-white/95 backdrop-blur md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-accent-500">Today</p>
          <h1 className="text-lg font-bold text-brand-900">{businessName}</h1>
        </div>
        <span className="rounded-full bg-accent-400 px-2.5 py-1 text-[10px] font-bold text-brand-900">
          Oil Mill
        </span>
      </div>
    </header>
  )
}
