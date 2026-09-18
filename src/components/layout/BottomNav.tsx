import { NavLink } from 'react-router-dom'
import { primaryNav } from '@/components/layout/navConfig'

function linkClass({ isActive }: { isActive: boolean }) {
  return `flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-bold leading-tight sm:text-xs ${
    isActive ? 'text-brand-700' : 'text-slate-500'
  }`
}

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-brand-100 bg-white shadow-[0_-4px_20px_rgba(6,26,51,0.08)] md:hidden"
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-lg">
        {primaryNav.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass}>
            {({ isActive }) => (
              <>
                <span
                  className={`h-1 w-8 rounded-full ${isActive ? 'bg-accent-400' : 'bg-transparent'}`}
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
