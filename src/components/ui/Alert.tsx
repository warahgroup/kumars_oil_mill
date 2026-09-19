type AlertProps = {
  variant: 'success' | 'error' | 'info'
  children: React.ReactNode
  title?: string
}

export function Alert({ variant, children, title }: AlertProps) {
  const styles = {
    success: 'border-green-700 bg-green-950/40 text-green-200',
    error: 'border-red-700 bg-red-950/40 text-red-200',
    info: 'border-brand-200 bg-brand-100/30 text-slate-100',
  }[variant]
  const defaultTitle =
    variant === 'success' ? 'Done' : variant === 'error' ? 'Please check' : 'Note'
  return (
    <div className={`rounded-2xl border-2 px-4 py-3 text-sm ${styles}`} role="alert">
      <p className="font-bold">{title ?? defaultTitle}</p>
      <p className="mt-1">{children}</p>
    </div>
  )
}
