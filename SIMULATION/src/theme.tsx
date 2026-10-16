import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, CssBaseline, ThemeProvider, createTheme, useMediaQuery } from '@mui/material'

import { ThemeContext } from './theme-context'
import type { ThemePreference as Preference } from './theme-context'
const STORAGE_KEY = 'mon-assistant.theme'

function createAppTheme(mode: 'light' | 'dark') {
  const dark = mode === 'dark'
  return createTheme({
    palette: {
      mode,
      primary: { main: dark ? '#86a8ef' : '#244a9d', contrastText: '#ffffff' },
      secondary: { main: dark ? '#9fb6ee' : '#101b50' },
      background: { default: dark ? '#0d1527' : '#edf0f7', paper: dark ? '#141f36' : '#ffffff' },
      text: { primary: dark ? '#f0f4fa' : '#1b2440', secondary: dark ? '#a0b0cb' : '#66718a' },
      divider: dark ? '#243350' : '#e4e8f1',
      success: { main: dark ? '#94d8ac' : '#24734d' },
      info: { main: dark ? '#86a8ef' : '#2d5fcb' },
      warning: { main: dark ? '#f1cc8c' : '#975713' },
      error: { main: dark ? '#ffb4ad' : '#a32d2d' },
    },
    typography: {
      fontFamily: '"Segoe UI", -apple-system, system-ui, Inter, Arial, sans-serif',
      h1: { fontSize: 'clamp(2rem, 4vw, 3.6rem)', fontWeight: 650, lineHeight: 1.12, letterSpacing: '-0.04em' },
      h2: { fontSize: '1.6rem', fontWeight: 650, letterSpacing: '-0.025em' },
      h3: { fontSize: '1.12rem', fontWeight: 650 },
      body1: { fontSize: '0.94rem', lineHeight: 1.7 },
      body2: { fontSize: '0.84rem', lineHeight: 1.6 },
      button: { textTransform: 'none', fontWeight: 650 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            '--surface': dark ? '#141f36' : '#ffffff',
            '--surface-muted': dark ? '#1c2a46' : '#edf2fc',
            '--border': dark ? '#243350' : '#e4e8f1',
            '--text': dark ? '#f0f4fa' : '#1b2440',
            '--muted': dark ? '#a0b0cb' : '#66718a',
            '--accent': dark ? '#86a8ef' : '#244a9d',
            '--navy': '#101b50',
            '--blue': '#2d5fcb',
          },
          body: { transition: 'background-color 160ms ease, color 160ms ease' },
          'a, button, input, select': { WebkitTapHighlightColor: 'transparent' },
          ':focus-visible': { outline: `3px solid ${dark ? '#86a8ef' : '#244a9d'}`, outlineOffset: '3px' },
          '@media (prefers-reduced-motion: reduce)': { '*, *::before, *::after': { transition: 'none !important', scrollBehavior: 'auto !important' } },
        },
      },
      MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { minHeight: 42, borderRadius: 8 } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 550, fontSize: '0.72rem' } } },
      MuiLink: { defaultProps: { underline: 'hover' } },
    },
  })
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const [initial] = useState<{ preference: Preference; error: string }>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved !== null && saved !== 'light' && saved !== 'dark' && saved !== 'system') throw new Error('Préférence de thème invalide.')
      return { preference: saved ?? 'system', error: '' }
    } catch (error) {
      console.error('Lecture du thème impossible.', error)
      return { preference: 'system' as const, error: "Le thème enregistré est inaccessible. Le thème système est utilisé." }
    }
  })
  const [preference, setPreferenceState] = useState<Preference>(initial.preference)
  const [error, setError] = useState(initial.error)
  const mode = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
  const theme = useMemo(() => createAppTheme(mode), [mode])
  useEffect(() => {
    document.documentElement.dataset.theme = mode
    document.documentElement.style.colorScheme = mode
  }, [mode])
  function setPreference(value: Preference) {
    setPreferenceState(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
      setError('')
    } catch (storageError) {
      console.error('Enregistrement du thème impossible.', storageError)
      setError("Le thème est appliqué, mais votre navigateur empêche sa mémorisation.")
    }
  }
  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {error && <Alert severity="warning">{error}</Alert>}
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  )
}
