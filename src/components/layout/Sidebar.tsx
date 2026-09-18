import { NavLink } from 'react-router-dom'
import { sidebarNav } from '@/components/layout/navConfig'

function linkClass({ isActive }: { isActive: boolean }) {
  return `flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold transition ${
    isActive
      ? 'bg-brand-700 text-white shadow-sm'
      : 'text-brand-800 hover:bg-brand-100'
  }`
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-brand-100 bg-white md:block">
      <div className="border-b border-brand-100 bg-brand-800 px-5 py-6 text-white">
        <p className="text-base font-bold">Kumar Oil Mill</p>
        <p className="mt-0.5 text-xs text-brand-100">Simple business tools</p>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {sidebarNav.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
