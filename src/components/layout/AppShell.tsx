import { useCallback, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { MobileDrawer } from '@/components/layout/MobileDrawer'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { useSwipeOpenMenu } from '@/hooks/useSwipeOpenMenu'

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const openMenu = useCallback(() => setMenuOpen(true), [])
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  useSwipeOpenMenu(mainRef, openMenu)

  return (
    <div className="min-h-screen bg-brand-900 md:flex">
      <Sidebar />
      <MobileDrawer open={menuOpen} onClose={closeMenu} />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar onOpenMenu={openMenu} />
        <main ref={mainRef} className="flex-1 px-4 pb-8 pt-4 md:px-8 md:pt-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
