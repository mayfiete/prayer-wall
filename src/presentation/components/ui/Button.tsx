import React, { type ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const variantClasses = {
  primary: 'font-semibold shadow-md',
  secondary: 'border',
  ghost: 'bg-transparent',
}

const variantStyles: Record<string, React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--color-modal-accent)',
    color: 'var(--color-modal-bg)',
  },
  secondary: {
    backgroundColor: 'color-mix(in srgb, var(--color-modal-text) 10%, transparent)',
    color: 'var(--color-modal-text)',
    borderColor: 'color-mix(in srgb, var(--color-modal-text) 25%, transparent)',
  },
  ghost: {
    color: 'color-mix(in srgb, var(--color-modal-text) 70%, transparent)',
  },
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-7 py-3 text-lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{ ...variantStyles[variant], ...style }}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-md transition-colors duration-150',
        'focus:outline-none focus-visible:ring-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}
