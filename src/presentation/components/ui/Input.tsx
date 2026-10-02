import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label
        htmlFor={inputId}
        className="text-sm font-medium"
        style={{ color: 'color-mix(in srgb, var(--color-modal-text) 80%, transparent)' }}
      >
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
        className={[
          'min-h-12 min-w-0 w-full rounded-lg border px-3 py-3 text-base',
          'focus:outline-none focus:ring-2 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
          error ? 'border-red-500' : '',
          className,
        ].join(' ')}
        style={{
          backgroundColor: 'color-mix(in srgb, var(--color-modal-bg) 70%, #000)',
          color: 'var(--color-modal-text)',
          borderColor: error ? undefined : 'color-mix(in srgb, var(--color-modal-text) 25%, transparent)',
          // @ts-expect-error CSS custom property
          '--tw-ring-color': 'var(--color-modal-accent)',
        }}
      />
      {error && <p id={`${inputId}-error`} className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
