import { Link, NavLink } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'

export const AdminShellRoot = styled('div', {
  base: {
    display: 'flex',
    minHeight: '100dvh',
    bg: 'bg.canvas',
    color: 'text.primary',
    fontFamily: 'body',
    overflowX: 'hidden',
  },
})

export const SidebarShellRoot = styled('aside', {
  base: {
    // Wide enough for the wordmark to sit beside the collapse control without
    // either being truncated.
    width: '240px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4',
    minHeight: '100dvh',
    bg: 'bg.sidebar',
    borderRightWidth: { base: '0', md: '1px' },
    borderColor: 'border.default',
    px: '3',
    py: '4',
    position: { base: 'fixed', md: 'relative' },
    top: { base: '16', md: 'auto' },
    right: { base: 'auto', md: 'auto' },
    bottom: { base: '0', md: 'auto' },
    left: { base: '0', md: 'auto' },
    zIndex: { base: '20', md: 'auto' },
    boxShadow: { base: '0 0 24px rgba(0, 0, 0, 0.18)', md: 'none' },
    overflow: 'hidden',
    transform: 'translateX(0)',
    transition: 'transform 0.22s ease, width 0.22s ease, padding 0.22s ease, opacity 0.2s ease',
  },
  variants: {
    // Collapsing means two different things by breakpoint: on a phone the
    // panel is an overlay drawer that slides off-canvas entirely, while from
    // `md` up it shrinks to an icon rail that stays on screen and operable.
    collapsed: {
      true: {
        transform: { base: 'translateX(-100%)', md: 'none' },
        width: { md: '16' },
        px: { md: '2' },
        pointerEvents: { base: 'none', md: 'auto' },
      },
    },
  },
})

export const SidebarBackdrop = styled('button', {
  base: {
    position: 'fixed',
    top: { base: '16', md: '0' },
    right: '0',
    bottom: '0',
    left: '0',
    bg: 'rgba(0, 0, 0, 0.4)',
    borderWidth: '0',
    cursor: 'pointer',
    zIndex: '10',
    display: { base: 'block', md: 'none' },
    opacity: '0',
    pointerEvents: 'none',
    transition: 'opacity 0.22s ease',
  },
  variants: {
    visible: {
      true: { opacity: '1', pointerEvents: 'auto' },
    },
  },
})

// Holds the wordmark and the collapse control. Side by side when the panel is
// open; stacked and centred once it is down to an icon rail.
export const SidebarHeaderRow = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '2',
  },
  variants: {
    railed: {
      true: {
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '2',
      },
    },
  },
})

export const SidebarBrandLink = styled(Link, {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '2.5',
    minWidth: '0',
    px: '1',
    py: '1',
    color: 'text.primary',
    textDecoration: 'none',
    fontSize: 'sm',
    fontWeight: 'bold',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    borderRadius: 'control',
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'accent.default',
      outlineOffset: '2px',
    },
  },
})

// The gradient square from the landing wordmark, at sidebar scale.
export const SidebarBrandMark = styled('span', {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: '0',
    width: '8',
    height: '8',
    borderRadius: 'control',
    color: 'white',
    backgroundImage:
      'linear-gradient(150deg, token(colors.brand.500) 0%, token(colors.brand.400) 100%)',
  },
})

// The collapse control proper, living on the panel it collapses. Hidden below
// `md`, where the panel is an off-canvas drawer and a control inside it would
// be unreachable once closed.
export const SidebarCollapseButton = styled('button', {
  base: {
    display: { base: 'none', md: 'inline-flex' },
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: '0',
    width: '9',
    height: '9',
    borderRadius: 'control',
    color: 'text.muted',
    bg: 'transparent',
    borderWidth: '1px',
    borderColor: 'transparent',
    cursor: 'pointer',
    transition: 'background-color 0.18s ease, color 0.18s ease',
    _hover: { bg: 'accent.subtle', color: 'accent.fg' },
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'accent.default',
      outlineOffset: '2px',
    },
  },
})

// The text half of any sidebar row (wordmark, nav item, footer action). The
// icon stays put and this drops out when the panel is railed, which is what
// keeps the rail readable as a column of icons.
export const SidebarItemLabel = styled('span', {
  base: {
    minWidth: '0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  variants: {
    railed: {
      true: { display: 'none' },
    },
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
    fontWeight: 'medium',
    transition: 'background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease',
    _hover: { bg: 'bg.sunken', color: 'text.primary' },
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'accent.default',
      outlineOffset: '2px',
    },
  },
  variants: {
    active: {
      true: {
        bg: 'accent.subtle',
        color: 'accent.fg',
        borderColor: 'accent.border',
        fontWeight: 'semibold',
        _hover: { bg: 'accent.subtle', color: 'accent.fg' },
      },
    },
    railed: {
      true: { justifyContent: 'center', px: '0' },
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
    transition: 'background-color 0.15s ease, color 0.15s ease',
    _hover: { bg: 'bg.sunken', color: 'text.primary' },
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'accent.default',
      outlineOffset: '2px',
    },
  },
  variants: {
    railed: {
      true: { justifyContent: 'center', px: '0' },
    },
  },
})

export const SwitcherRoot = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1',
  },
})

export const SwitcherToggleButton = styled('button', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '2',
    width: 'full',
    borderRadius: 'control',
    borderWidth: '1px',
    borderColor: 'border.default',
    bg: 'bg.surface',
    px: '3',
    py: '2',
    cursor: 'pointer',
    color: 'text.muted',
    boxShadow: 'card',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
    _hover: { borderColor: 'accent.default', color: 'text.primary' },
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'accent.default',
      outlineOffset: '2px',
    },
  },
  variants: {
    railed: {
      true: { justifyContent: 'center', px: '0', py: '2.5' },
    },
  },
})

export const SwitcherToggleText = styled('span', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.5',
  },
})

export const SwitcherToggleLabel = styled('span', {
  base: {
    fontSize: 'xs',
    color: 'text.placeholder',
    textTransform: 'uppercase',
    letterSpacing: 'wide',
  },
})

export const SwitcherToggleName = styled('span', {
  base: {
    fontSize: 'sm',
    fontWeight: 'semibold',
    color: 'text.primary',
  },
})

export const SwitcherPanel = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'control',
    bg: 'bg.surface',
    p: '2',
  },
})

export const SwitcherEventList = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5',
  },
})

export const SwitcherEventLink = styled(Link, {
  base: {
    display: 'block',
    borderRadius: 'control',
    px: '2',
    py: '1.5',
    fontSize: 'sm',
    color: 'text.primary',
    textDecoration: 'none',
    transition: 'background-color 0.15s ease',
    _hover: { bg: 'bg.sunken' },
  },
})

export const SwitcherCreateLink = styled(Link, {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5',
    borderRadius: 'control',
    px: '2',
    py: '1.5',
    fontSize: 'sm',
    fontWeight: 'medium',
    color: 'accent.default',
    textDecoration: 'none',
    borderTopWidth: '1px',
    borderColor: 'border.default',
    mt: '1',
    pt: '2',
    transition: 'background-color 0.15s ease',
    _hover: { bg: 'bg.sunken' },
  },
})

export const SwitcherStatusText = styled('p', {
  base: {
    fontSize: 'sm',
    color: 'text.muted',
    px: '2',
    py: '1',
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
    minHeight: '16',
    borderBottomWidth: '1px',
    borderColor: 'border.default',
    px: { base: '3', sm: '6' },
    py: '3',
    position: 'sticky',
    top: '0',
    zIndex: '30',
    bg: 'bg.canvas/80',
    backdropFilter: 'blur(8px)',
  },
})

// The phone-only drawer trigger. From `md` up the panel never leaves the
// screen, so its own `SidebarCollapseButton` owns the toggle instead.
export const CollapseToggleButton = styled('button', {
  base: {
    display: { base: 'inline-flex', md: 'none' },
    alignItems: 'center',
    justifyContent: 'center',
    width: '11',
    height: '11',
    borderRadius: 'control',
    p: '1.5',
    color: 'text.muted',
    bg: 'transparent',
    borderWidth: '1px',
    borderColor: 'transparent',
    cursor: 'pointer',
    transition: 'background-color 0.18s ease, color 0.18s ease',
    _hover: { bg: 'accent.subtle', color: 'accent.fg' },
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'accent.default',
      outlineOffset: '2px',
    },
  },
})

export const BreadcrumbNav = styled('nav', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5',
    minWidth: '0',
    fontSize: 'sm',
    overflow: 'hidden',
  },
})

// The section-root of the trail: an icon-only link (no text label) standing in
// for the top-level section (Overview / Events).
export const BreadcrumbIconLink = styled(Link, {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: '8',
    height: '8',
    borderRadius: 'control',
    color: 'text.muted',
    textDecoration: 'none',
    transition: 'background-color 0.18s ease, color 0.18s ease',
    _hover: { bg: 'accent.subtle', color: 'accent.fg' },
  },
})

export const BreadcrumbSeparator = styled('span', {
  base: {
    flexShrink: 0,
    color: 'text.placeholder',
    fontSize: 'sm',
  },
})

export const BreadcrumbLink = styled(Link, {
  base: {
    flexShrink: 0,
    color: 'text.muted',
    textDecoration: 'none',
    fontWeight: 'medium',
    borderRadius: 'control',
    px: '1.5',
    py: '0.5',
    transition: 'background-color 0.15s ease, color 0.15s ease',
    _hover: { bg: 'bg.sunken', color: 'text.primary' },
  },
})

// The trailing crumb (the current screen): plain text, allowed to truncate
// when the trail is long rather than pushing the row into a horizontal scroll.
export const BreadcrumbCurrent = styled('span', {
  base: {
    minWidth: '0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: 'semibold',
    color: 'text.primary',
    px: '1.5',
  },
})

export const PageOutletWrapper = styled('div', {
  base: {
    flex: '1',
    overflow: 'auto',
  },
})
