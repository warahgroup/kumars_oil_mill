type Tab = { id: string; label: string }

type TabsProps = {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
            active === tab.id
              ? 'bg-brand-600 text-white'
              : 'bg-surface-elevated text-slate-300 ring-1 ring-brand-100'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
