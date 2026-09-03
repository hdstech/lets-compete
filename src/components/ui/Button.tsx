import { Link } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'

// Shared pill-button recipe reused across every feature (events, auth forms,
// admin shell) — a single definition keeps tone/hover/disabled/focus states
// consistent instead of drifting per feature.
const buttonRecipe = {
  base: {
    borderRadius: 'pill',
    px: '4',
    py: '2',
    fontSize: 'sm',
    fontWeight: 'semibold',
    cursor: 'pointer',
    borderWidth: '1px',
    borderColor: 'transparent',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1.5',
    textDecoration: 'none',
    textAlign: 'center',
    _disabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'accent.default',
      outlineOffset: '2px',
    },
  },
  variants: {
    tone: {
      primary: { bg: 'text.primary', color: 'bg.surface', _hover: { bg: 'ink.800' } },
      secondary: {
        bg: 'transparent',
        color: 'text.primary',
        borderColor: 'border.default',
        _hover: { bg: 'bg.sunken' },
      },
      danger: { bg: 'red.600', color: 'white', _hover: { bg: 'red.700' } },
      success: { bg: 'green.600', color: 'white', _hover: { bg: 'green.700' } },
    },
  },
  defaultVariants: { tone: 'primary' },
} as const

export const Button = styled('button', buttonRecipe)
export const LinkButton = styled(Link, buttonRecipe)
