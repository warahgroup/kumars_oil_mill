import type { TextareaHTMLAttributes } from 'react'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  error?: string
}

export function Textarea({ label, error, className = '', ...props }: TextareaProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-200">{label}</span>
      <textarea
        className={`min-h-24 w-full rounded-xl border border-brand-100 bg-surface-elevated px-3 py-2 text-base text-slate-100 outline-none ring-brand-500 focus:ring-2 ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  )
}
