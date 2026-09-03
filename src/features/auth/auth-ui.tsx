import { Link } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'

export const AuthShell = styled('main', {
  base: {
    display: 'flex',
    minHeight: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    bg: 'bg.canvas',
    color: 'text.primary',
    px: '4',
  },
})

export const AuthCard = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5',
    width: 'full',
    maxWidth: '96',
    bg: 'bg.surface',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'card',
    p: '6',
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
    color: 'text.primary',
    fontSize: 'sm',
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
    minHeight: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    bg: 'bg.canvas',
    color: 'text.muted',
    fontSize: 'sm',
  },
})
