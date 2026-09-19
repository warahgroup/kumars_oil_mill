import { NavLink } from 'react-router-dom'
import { sidebarNav } from '@/components/layout/navConfig'

function linkClass({ isActive }: { isActive: boolean }) {
  return `flex min-h-12 items-center rounded-xl px-3 text-base font-semibold transition ${
    isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-100 hover:bg-brand-100'
  }`
}

type NavMenuProps = {
  onNavigate?: () => void
}

export function NavMenu({ onNavigate }: NavMenuProps) {
  return (
    <>
      <div className="border-b border-brand-100 bg-brand-800 px-5 py-6 text-white">
        <p className="text-base font-bold">Kumar Oil Mill</p>
        <p className="mt-0.5 text-xs text-slate-400">Swipe left or tap ☰</p>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {sidebarNav.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass} onClick={onNavigate}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
