import { useState, useEffect } from 'react'

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
