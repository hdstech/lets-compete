import { NavLink } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'

export const AdminShellRoot = styled('div', {
  base: {
    display: 'flex',
    minHeight: '100vh',
    bg: 'bg.canvas',
    color: 'text.primary',
    fontFamily: 'body',
  },
})

export const SidebarShellRoot = styled('aside', {
  base: {
    width: '220px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4',
    minHeight: '100vh',
    bg: 'bg.sidebar',
    px: '3',
    py: '4',
  },
})

export const SidebarNavRoot = styled('nav', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1',
  },
})

export const SidebarNavItemLink = styled(NavLink, {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '2',
    borderRadius: 'control',
    px: '3',
    py: '2',
    fontSize: 'sm',
    color: 'text.muted',
    textDecoration: 'none',
    borderWidth: '1px',
    borderColor: 'transparent',
    _hover: { bg: 'bg.sunken' },
  },
  variants: {
    active: {
      true: {
        bg: 'bg.surface',
        color: 'text.primary',
        borderColor: 'border.default',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
      },
    },
  },
})

export const SidebarFooterRoot = styled('div', {
  base: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1',
    borderTopWidth: '1px',
    borderColor: 'border.default',
    pt: '3',
  },
})

export const SidebarFooterButton = styled('button', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '2',
    borderRadius: 'control',
    px: '3',
    py: '2',
    fontSize: 'sm',
    color: 'text.muted',
    bg: 'transparent',
    borderWidth: '1px',
    borderColor: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    _hover: { bg: 'bg.sunken', color: 'text.primary' },
  },
})

export const SwitcherPlaceholderRoot = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5',
    borderRadius: 'control',
    borderWidth: '1px',
    borderColor: 'border.default',
    bg: 'bg.surface',
    px: '3',
    py: '2',
  },
})

export const SwitcherPlaceholderLabel = styled('span', {
  base: {
    fontSize: 'xs',
    color: 'text.placeholder',
    textTransform: 'uppercase',
    letterSpacing: 'wide',
  },
})

export const SwitcherPlaceholderName = styled('span', {
  base: {
    fontSize: 'sm',
    fontWeight: 'semibold',
    color: 'text.primary',
  },
})

export const ContentArea = styled('div', {
  base: {
    flex: '1',
    display: 'flex',
    flexDirection: 'column',
    minWidth: '0',
  },
})

export const ContentHeaderRoot = styled('header', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '3',
    borderBottomWidth: '1px',
    borderColor: 'border.default',
    px: '6',
    py: '3',
  },
})

export const CollapseToggleButton = styled('button', {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'control',
    p: '1.5',
    color: 'text.muted',
    bg: 'transparent',
    borderWidth: '1px',
    borderColor: 'transparent',
    cursor: 'pointer',
    _hover: { bg: 'bg.sunken', color: 'text.primary' },
  },
})

export const Breadcrumb = styled('span', {
  base: {
    fontSize: 'sm',
    fontWeight: 'medium',
    color: 'text.primary',
  },
})

export const PageOutletWrapper = styled('div', {
  base: {
    flex: '1',
    overflow: 'auto',
  },
})
