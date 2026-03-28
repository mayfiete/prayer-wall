import { FlaskConical } from 'lucide-react'

const IS_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export function MockBanner() {
  if (!IS_MOCK) return null

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-900/40 border-b border-amber-700/60 text-amber-300 text-xs font-medium">
      <FlaskConical size={13} />
      Mock mode — in-memory data only. A new live brick appears every ~9 seconds.
    </div>
  )
}
