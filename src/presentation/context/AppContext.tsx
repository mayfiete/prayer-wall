import { createContext, useContext, type ReactNode } from 'react'
import { container } from '../../infrastructure/container'

type Container = typeof container

const AppContext = createContext<Container | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  return <AppContext.Provider value={container}>{children}</AppContext.Provider>
}

export function useContainer(): Container {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useContainer must be used within AppProvider')
  return ctx
}
