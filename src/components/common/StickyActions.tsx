import type { ReactNode } from 'react'

export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div
      className="sticky bottom-[4.5rem] z-20 -mx-4 border-t border-brand-100 bg-white/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:mt-6 md:border-0 md:bg-transparent md:p-0"
    >
      {children}
    </div>
  )
}
