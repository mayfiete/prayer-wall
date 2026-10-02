import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement as HTMLElement | null
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      className="wall-dialog"
      aria-labelledby={titleId}
      onCancel={e => { e.preventDefault(); onClose() }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="wall-dialog-panel flex min-w-0 w-full flex-col shadow-2xl"
        style={{
          backgroundColor: 'var(--color-modal-bg)',
          color: 'var(--color-modal-text)',
          fontFamily: 'var(--font-modal)',
          border: '1px solid color-mix(in srgb, var(--color-modal-text) 20%, transparent)',
        }}
      >
        <div
          className="dialog-heading flex shrink-0 items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4"
          style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-modal-text) 15%, transparent)' }}
        >
          <h2 id={titleId} className="min-w-0 break-words text-lg font-semibold" style={{ fontFamily: 'var(--font-modal)' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>
        <div className="dialog-content min-h-0 flex-1 overflow-y-auto overscroll-contain break-words px-4 py-5 sm:px-6">{children}</div>
      </div>
    </dialog>
  )
}
