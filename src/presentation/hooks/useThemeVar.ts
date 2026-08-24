import { useState, useEffect } from 'react'

export function useThemeVar(varName: string, fallback: string): string {
  const [val, setVal] = useState(
    () => getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback
  )
  useEffect(() => {
    const obs = new MutationObserver(() => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
      if (v) setVal(v)
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => obs.disconnect()
  }, [varName])
  return val
}

export function useLogoUrl(): string {
  const [logoUrl, setLogoUrl] = useState<string>(
    () => getComputedStyle(document.documentElement).getPropertyValue('--logo-url').trim()
  )
  useEffect(() => {
    const obs = new MutationObserver(() => {
      const val = getComputedStyle(document.documentElement).getPropertyValue('--logo-url').trim()
      setLogoUrl(val)
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => obs.disconnect()
  }, [])
  return logoUrl
}
