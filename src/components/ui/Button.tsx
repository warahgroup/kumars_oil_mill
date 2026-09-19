import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  fullWidth?: boolean
  size?: 'md' | 'lg'
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-500 shadow-sm',
  secondary:
    'bg-surface-elevated text-slate-100 border-2 border-brand-100 hover:bg-brand-100',
  ghost: 'bg-transparent text-slate-200 hover:bg-brand-100',
  danger: 'bg-red-950/50 text-red-300 border border-red-800 hover:bg-red-900/40',
  accent: 'bg-accent-400 text-brand-900 hover:bg-accent-500 shadow-sm',
}

export function Button({
  variant = 'primary',
  fullWidth,
  size = 'md',
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const sizeClass = size === 'lg' ? 'min-h-14 text-base px-6' : 'min-h-12 text-sm px-4'
  return (
    <button
      className={`inline-flex items-center justify-center rounded-2xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClass} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled}
      {...props}
    />
  )
}
