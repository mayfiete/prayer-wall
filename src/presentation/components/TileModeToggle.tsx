import { useTileMode } from '../context/TileModeContext'

export function TileModeToggle() {
  const { mode, toggle } = useTileMode()

  return (
    <div
      role="group"
      aria-label="Wall material"
      className="flex items-center p-0.5 rounded-full bg-parchment-200 border border-parchment-300 text-sm select-none"
    >
      <button
        type="button"
        onClick={() => mode !== 'stone' && toggle()}
        aria-pressed={mode === 'stone'}
        className={[
          'px-3 py-1 rounded-full transition-all duration-200 font-medium',
          mode === 'stone'
            ? 'bg-white text-[#524e48] shadow-sm'
            : 'text-[#9a8e80] hover:text-[#524e48]',
        ].join(' ')}
      >
        🪨 Stone
      </button>
      <button
        type="button"
        onClick={() => mode !== 'brick' && toggle()}
        aria-pressed={mode === 'brick'}
        className={[
          'px-3 py-1 rounded-full transition-all duration-200 font-medium',
          mode === 'brick'
            ? 'bg-[#6b2737] text-white shadow-sm'
            : 'text-[#9a8e80] hover:text-[#524e48]',
        ].join(' ')}
      >
        🧱 Brick
      </button>
    </div>
  )
}
