import { useSyncExternalStore } from 'react'
import { getThemeText, subscribeThemeText } from '../../infrastructure/theme'
import type { ThemeTextKey } from '../../infrastructure/theme'

/**
 * Reads an admin-editable UI string from the theme text store, falling back to
 * the page's own wording until a theme has been loaded for this wall.
 */
export function useThemeText(key: ThemeTextKey, fallback: string): string {
  const text = useSyncExternalStore(subscribeThemeText, getThemeText, getThemeText)
  return text[key] ?? fallback
}
