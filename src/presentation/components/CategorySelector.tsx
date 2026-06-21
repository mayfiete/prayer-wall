import type { PrayerCategory } from '../../domain/entities/PrayerCategory'
import { Check } from 'lucide-react'

const MAX_SELECTIONS = 3

interface CategorySelectorProps {
  categories: PrayerCategory[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function CategorySelector({ categories, selected, onChange }: CategorySelectorProps) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id))
    } else if (selected.length < MAX_SELECTIONS) {
      onChange([...selected, id])
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs" style={{ color: 'color-mix(in srgb, var(--color-modal-text) 60%, transparent)' }}>
        Select up to {MAX_SELECTIONS} areas you will pray for ({selected.length}/{MAX_SELECTIONS})
      </p>
      <div className="grid grid-cols-2 gap-2">
        {categories.map((cat) => {
          const isSelected = selected.includes(cat.id)
          const isDisabled = !isSelected && selected.length >= MAX_SELECTIONS
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggle(cat.id)}
              disabled={isDisabled}
              aria-pressed={isSelected}
              className={[
                'flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-left',
                'border transition-all duration-150 focus:outline-none focus-visible:ring-2',
                isDisabled ? 'cursor-not-allowed opacity-50' : '',
              ].join(' ')}
              style={{
                backgroundColor: isSelected
                  ? 'color-mix(in srgb, var(--color-modal-accent) 20%, transparent)'
                  : 'color-mix(in srgb, var(--color-modal-text) 8%, transparent)',
                borderColor: isSelected
                  ? 'var(--color-modal-accent)'
                  : 'color-mix(in srgb, var(--color-modal-text) 25%, transparent)',
                color: isSelected
                  ? 'var(--color-modal-accent)'
                  : 'color-mix(in srgb, var(--color-modal-text) 75%, transparent)',
              }}
            >
              <span
                className="flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center"
              style={{
                backgroundColor: isSelected ? 'var(--color-modal-accent)' : 'transparent',
                borderColor: isSelected ? 'var(--color-modal-accent)' : 'color-mix(in srgb, var(--color-modal-text) 35%, transparent)',
              }}
              >
                {isSelected && <Check size={10} strokeWidth={3} style={{ color: 'var(--color-modal-bg)' }} />}
              </span>
              {cat.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
