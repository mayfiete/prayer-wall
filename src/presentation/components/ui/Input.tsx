import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-stone-300">
        {label}
      </label>
      <input
        id={inputId}
        {...props}
        className={[
          'rounded-md bg-stone-800 border px-3 py-2 text-stone-100 placeholder-stone-500',
          'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
          error ? 'border-red-500' : 'border-stone-600',
          className,
        ].join(' ')}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
