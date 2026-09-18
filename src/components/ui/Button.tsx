import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  fullWidth?: boolean
  size?: 'md' | 'lg'
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm',
  secondary:
    'bg-white text-brand-800 border-2 border-brand-100 hover:bg-brand-50',
  ghost: 'bg-transparent text-brand-700 hover:bg-brand-100',
  danger: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
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
