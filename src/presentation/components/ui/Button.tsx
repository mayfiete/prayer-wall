import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const variantClasses = {
  primary: 'bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold shadow-md',
  secondary: 'bg-stone-700 hover:bg-stone-600 text-stone-100 border border-stone-600',
  ghost: 'bg-transparent hover:bg-stone-800 text-stone-300 hover:text-stone-100',
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
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-md transition-colors duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
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
