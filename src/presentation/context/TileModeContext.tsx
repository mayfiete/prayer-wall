import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export type TileMode = 'stone' | 'brick'

interface TileModeCtx {
  mode: TileMode
  isChanging: boolean
  toggle: () => void
}

const TileModeContext = createContext<TileModeCtx>({
  mode: 'stone',
  isChanging: false,
  toggle: () => {},
})

export function TileModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<TileMode>('stone')
  const [isChanging, setIsChanging] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const toggle = useCallback(() => {
    clearTimeout(timerRef.current)
    setIsChanging(true)
    setMode((m) => (m === 'stone' ? 'brick' : 'stone'))
    timerRef.current = setTimeout(() => setIsChanging(false), 440)
  }, [])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return (
    <TileModeContext.Provider value={{ mode, isChanging, toggle }}>
      {children}
    </TileModeContext.Provider>
  )
}

export function useTileMode(): TileModeCtx {
  return useContext(TileModeContext)
}
