import { createContext, useContext } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export const ThemeContext = createContext<{ preference: ThemePreference; setPreference: (value: ThemePreference) => void } | null>(null)

export function useAppTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('AppThemeProvider manquant.')
  return context
}
