import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 flex min-w-0 w-full max-w-md max-h-[calc(100dvh-2rem)] flex-col rounded-xl shadow-2xl animate-fade-in"
        style={{
          backgroundColor: 'var(--color-modal-bg)',
          color: 'var(--color-modal-text)',
          fontFamily: 'var(--font-modal)',
          border: '1px solid color-mix(in srgb, var(--color-modal-text) 20%, transparent)',
        }}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4"
          style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-modal-text) 15%, transparent)' }}
        >
          <h2 id="modal-title" className="min-w-0 break-words text-lg font-semibold" style={{ color: 'var(--color-modal-text)', fontFamily: 'var(--font-modal)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors"
            style={{ color: 'color-mix(in srgb, var(--color-modal-text) 60%, transparent)' }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain break-words px-4 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  )
}
