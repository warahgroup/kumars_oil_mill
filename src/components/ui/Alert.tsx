type AlertProps = {
  variant: 'success' | 'error' | 'info'
  children: React.ReactNode
  title?: string
}

export function Alert({ variant, children, title }: AlertProps) {
  const styles = {
    success: 'border-green-200 bg-green-50 text-green-900',
    error: 'border-red-200 bg-red-50 text-red-900',
    info: 'border-brand-200 bg-brand-50 text-brand-900',
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
