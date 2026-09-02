import { Link } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'

export const AuthShell = styled('main', {
  base: {
    display: 'flex',
    minHeight: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    bg: 'slate.950',
    color: 'slate.100',
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
    bg: 'slate.900',
    borderWidth: '1px',
    borderColor: 'slate.800',
    borderRadius: 'lg',
    p: '6',
  },
})

export const AuthTitle = styled('h1', {
  base: {
    fontSize: 'xl',
    fontWeight: 'semibold',
  },
})

export const AuthSubtitle = styled('p', {
  base: {
    fontSize: 'sm',
    color: 'slate.400',
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
    color: 'slate.300',
  },
})

export const Input = styled('input', {
  base: {
    bg: 'slate.950',
    borderWidth: '1px',
    borderColor: 'slate.700',
    borderRadius: 'md',
    px: '3',
    py: '2',
    color: 'slate.100',
    fontSize: 'sm',
    _focus: {
      outline: 'none',
      borderColor: 'slate.400',
    },
  },
})

export const ErrorText = styled('p', {
  base: {
    fontSize: 'sm',
    color: 'red.400',
  },
})

export const SubmitButton = styled('button', {
  base: {
    bg: 'slate.100',
    color: 'slate.950',
    borderRadius: 'md',
    py: '2',
    fontSize: 'sm',
    fontWeight: 'semibold',
    cursor: 'pointer',
    _disabled: {
      opacity: 0.6,
      cursor: 'not-allowed',
    },
  },
})

export const AuthFooterText = styled('p', {
  base: {
    fontSize: 'sm',
    color: 'slate.400',
  },
})

export const AuthLink = styled(Link, {
  base: {
    color: 'slate.100',
    textDecoration: 'underline',
  },
})

export const LoadingScreen = styled('div', {
  base: {
    display: 'flex',
    minHeight: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    bg: 'slate.950',
    color: 'slate.400',
    fontSize: 'sm',
  },
})
