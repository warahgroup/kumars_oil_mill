import { NavMenu } from '@/components/layout/NavMenu'

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-brand-100 bg-brand-900 md:block">
      <NavMenu />
    </aside>
  )
}
