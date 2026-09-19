import type { SelectHTMLAttributes } from 'react'

type Option = { value: string; label: string }

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label: string
  options: Option[]
  placeholder?: string
  error?: string
}

export function Select({
  label,
  options,
  placeholder = 'Select…',
  error,
  className = '',
  ...props
}: SelectProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-200">{label}</span>
      <select
        className={`min-h-12 w-full rounded-xl border-2 border-brand-100 bg-surface-elevated px-3 text-base text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error ? <span className="mt-1 block text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  )
}
