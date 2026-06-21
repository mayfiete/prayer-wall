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
        className="relative z-10 w-full max-w-md rounded-xl shadow-2xl animate-fade-in"
        style={{
          backgroundColor: 'var(--color-modal-bg)',
          color: 'var(--color-modal-text)',
          fontFamily: 'var(--font-modal)',
          border: '1px solid color-mix(in srgb, var(--color-modal-text) 20%, transparent)',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-modal-text) 15%, transparent)' }}
        >
          <h2 id="modal-title" className="text-lg font-semibold" style={{ color: 'var(--color-modal-text)', fontFamily: 'var(--font-modal)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'color-mix(in srgb, var(--color-modal-text) 60%, transparent)' }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
