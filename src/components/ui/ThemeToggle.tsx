import { Moon, Sun } from 'lucide-react'
import { styled } from '../../../styled-system/jsx'
import { useTheme } from '../../features/theme/useTheme'

const ToggleButton = styled('button', {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '10',
    height: '10',
    borderRadius: 'pill',
    borderWidth: '1px',
    borderColor: 'border.default',
    bg: 'bg.surface',
    color: 'text.muted',
    cursor: 'pointer',
    transition: 'color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease',
    _hover: { color: 'accent.default', borderColor: 'accent.default' },
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'accent.default',
      outlineOffset: '2px',
    },
  },
  variants: {
    // Pinned to the top-right of the surface it sits in — used on the pages
    // that have no sidebar to hold the control (landing, auth, join).
    floating: {
      true: { position: 'absolute', top: '5', right: '5', zIndex: '1' },
    },
  },
})

export function ThemeToggle({ floating }: { floating?: boolean }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <ToggleButton
      type="button"
      floating={floating}
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </ToggleButton>
  )
}
