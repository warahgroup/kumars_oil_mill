import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type PageShellProps = {
  title: string
  subtitle?: string
  backTo?: string
  backLabel?: string
  action?: ReactNode
  children: ReactNode
  width?: 'default' | 'narrow'
}

export function PageShell({
  title,
  subtitle,
  backTo,
  backLabel = 'Back',
  action,
  children,
  width = 'default',
}: PageShellProps) {
  return (
    <div className={width === 'narrow' ? 'mx-auto max-w-xl w-full' : 'page-container'}>
      <header className="mb-5 md:mb-6">
        {backTo ? (
          <Link
            to={backTo}
            className="mb-3 inline-flex min-h-10 items-center text-sm font-semibold text-brand-600"
          >
            ← {backLabel}
          </Link>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-brand-900 md:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-slate-400 md:text-base">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      </header>
      {children}
    </div>
  )
}
