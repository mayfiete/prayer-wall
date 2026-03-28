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
      <p className="text-xs text-stone-400">
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
                'border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
                isSelected
                  ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                  : isDisabled
                    ? 'bg-stone-800/40 border-stone-700 text-stone-500 cursor-not-allowed opacity-50'
                    : 'bg-stone-800 border-stone-600 text-stone-300 hover:border-stone-400 hover:text-stone-100',
              ].join(' ')}
            >
              <span
                className={[
                  'flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center',
                  isSelected ? 'bg-amber-500 border-amber-500' : 'border-stone-500',
                ].join(' ')}
              >
                {isSelected && <Check size={10} strokeWidth={3} className="text-stone-950" />}
              </span>
              {cat.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
