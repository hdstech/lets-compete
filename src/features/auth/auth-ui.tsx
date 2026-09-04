import { Link } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'

export const AuthShell = styled('main', {
  base: {
    display: 'flex',
    minHeight: '100dvh',
    alignItems: 'center',
    justifyContent: 'center',
    bg: 'bg.canvas',
    color: 'text.primary',
    px: '4',
    overflowX: 'hidden',
    paddingTop: 'max(1rem, env(safe-area-inset-top))',
    paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
    paddingLeft: 'max(1rem, env(safe-area-inset-left))',
    paddingRight: 'max(1rem, env(safe-area-inset-right))',
  },
  variants: {
    layout: {
      center: {},
      fill: {
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        px: '0',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: '0',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      },
    },
  },
  defaultVariants: { layout: 'center' },
})

export const AuthCard = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5',
    width: 'full',
    maxWidth: '96',
    minWidth: '0',
    bg: 'bg.surface',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'card',
    p: { base: '4', sm: '6' },
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
    _focus: {
      outline: 'none',
      borderColor: 'accent.default',
    },
  },
})

export const ErrorText = styled('p', {
  base: {
    fontSize: 'sm',
    color: 'red.400',
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
    color: 'text.primary',
    textDecoration: 'underline',
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
