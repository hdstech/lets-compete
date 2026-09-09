import { Link } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'

// The auth screens sit directly either side of the landing page, so they share
// its two-panel shape: the brand gradient on one side, the form on the app
// canvas on the other. Below `lg` the gradient becomes a short banner above
// the card rather than disappearing — it is the only thing tying a magic-link
// arrival back to the product it came from.
export const AuthRoot = styled('main', {
  base: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gridTemplateRows: 'auto 1fr',
    minHeight: '100dvh',
    bg: 'bg.canvas',
    color: 'text.primary',
    overflowX: 'hidden',
    lg: { gridTemplateColumns: '0.9fr 1fr', gridTemplateRows: '1fr' },
  },
})

export const AuthMain = styled('section', {
  base: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    px: '4',
    py: { base: '8', lg: '10' },
    paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
    paddingRight: 'max(1rem, env(safe-area-inset-right))',
    lg: { overflowY: 'auto' },
  },
})

export const AuthCard = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5',
    width: 'full',
    maxWidth: '26rem',
    minWidth: '0',
    bg: 'bg.surface',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'card',
    boxShadow: 'card',
    p: { base: '5', sm: '6' },
    animation: 'riseIn 0.5s ease-out both',
    _motionReduce: { animation: 'none' },
  },
})

export const AuthForm = styled('form', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4',
  },
})

export const Field = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5',
  },
})

export const Label = styled('label', {
  base: {
    fontSize: 'sm',
    fontWeight: 'medium',
    color: 'text.primary',
  },
})

export const Input = styled('input', {
  base: {
    bg: 'bg.sunken',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'control',
    px: '3',
    py: '2',
    minHeight: '11',
    width: 'full',
    color: 'text.primary',
    fontSize: 'md',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease',
    _placeholder: { color: 'text.placeholder' },
    _hover: { borderColor: 'border.strong' },
    _focus: {
      outline: 'none',
      bg: 'bg.surface',
      borderColor: 'accent.solid',
      boxShadow: '0 0 0 3px token(colors.accent.subtle)',
    },
  },
})

// A soft alert row rather than bare red text: it reads as part of the form's
// surface language instead of a stray sentence.
export const ErrorText = styled('p', {
  base: {
    display: 'flex',
    gap: '2',
    fontSize: 'sm',
    color: 'danger.fg',
    bg: 'danger.subtle',
    borderWidth: '1px',
    borderColor: 'danger.border',
    borderRadius: 'control',
    px: '3',
    py: '2',
  },
})

export const AuthFooterText = styled('p', {
  base: {
    fontSize: 'sm',
    color: 'text.muted',
  },
})

export const AuthLink = styled(Link, {
  base: {
    color: 'accent.default',
    fontWeight: 'medium',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
    _hover: { color: 'accent.hover' },
  },
})

export const LoadingScreen = styled('div', {
  base: {
    display: 'flex',
    minHeight: '100dvh',
    alignItems: 'center',
    justifyContent: 'center',
    bg: 'bg.canvas',
    color: 'text.muted',
    fontSize: 'sm',
  },
})
