import { Link } from 'react-router-dom'

const styles = {
  sales: 'bg-action-sales text-white',
  production: 'bg-action-production text-white',
  purchase: 'bg-action-purchase text-brand-900',
  expense: 'bg-action-expense text-white',
} as const

export function QuickActionButton({
  to,
  label,
  kind,
}: {
  to: string
  label: string
  kind: keyof typeof styles
}) {
  return (
    <Link
      to={to}
      className={`flex min-h-[4.5rem] items-center justify-center rounded-2xl text-center text-base font-bold shadow-md transition active:scale-[0.98] md:min-h-24 md:text-lg ${styles[kind]}`}
    >
      {label}
    </Link>
  )
}
