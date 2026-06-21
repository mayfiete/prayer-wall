import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={inputId}
        className="text-sm font-medium"
        style={{ color: 'color-mix(in srgb, var(--color-modal-text) 80%, transparent)' }}
      >
        {label}
      </label>
      <input
        id={inputId}
        {...props}
        className={[
          'rounded-md border px-3 py-2',
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
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
