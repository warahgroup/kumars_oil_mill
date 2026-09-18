import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
  padding = 'normal',
}: {
  children: ReactNode
  className?: string
  padding?: 'normal' | 'lg' | 'none'
}) {
  const pad =
    padding === 'lg' ? 'p-5 md:p-6' : padding === 'none' ? '' : 'p-4 md:p-5'
  return (
    <div className={`surface-card ${pad} ${className}`}>{children}</div>
  )
}
