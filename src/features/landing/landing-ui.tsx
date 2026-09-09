import { Link } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'

// The gradient panel itself, its glows, grid, wordmark and headline now live
// in components/ui/brand-surface — they are shared with the auth pages and the
// participant screens. What stays here is the landing page's own half: the
// action column, and the live-standings demo that only this page runs.

export const LandingRoot = styled('main', {
  base: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gridTemplateRows: 'auto 1fr',
    minHeight: '100dvh',
    bg: 'bg.canvas',
    color: 'text.primary',
    overflowX: 'hidden',
    lg: {
      gridTemplateColumns: '1.05fr 1fr',
      gridTemplateRows: '1fr',
      maxHeight: '100dvh',
    },
  },
})

export const ActionPanel = styled('section', {
  base: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    px: { base: '6', md: '10', lg: '12' },
    py: { base: '12', lg: '10' },
    paddingBottom: 'max(3rem, env(safe-area-inset-bottom))',
    lg: {
      paddingRight: 'max(3rem, env(safe-area-inset-right))',
      overflowY: 'auto',
    },
  },
})

export const ActionBody = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5',
    width: 'full',
    maxWidth: '30rem',
    marginX: { base: '0', lg: 'auto' },
  },
})

export const Eyebrow = styled('span', {
  base: {
    alignSelf: 'flex-start',
    fontSize: 'xs',
    fontWeight: 'semibold',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'text.muted',
    bg: 'bg.surface',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'pill',
    px: '3',
    py: '1.5',
  },
})

export const ActionHeading = styled('h2', {
  base: {
    fontSize: { base: '3xl', md: '4xl' },
    fontWeight: 'bold',
    letterSpacing: '-0.02em',
    textWrap: 'balance',
  },
})

export const ActionText = styled('p', {
  base: {
    fontSize: 'md',
    color: 'text.muted',
    maxWidth: '42ch',
  },
})

// Wraps the call-to-action so its arrow can react to hover without stacking
// another styled() layer on top of the shared Button recipe.
export const CtaRow = styled('div', {
  base: {
    marginTop: '1',
    '& svg': { transition: 'transform 0.18s ease' },
    '&:hover svg': { transform: 'translateX(4px)' },
    _motionReduce: { '&:hover svg': { transform: 'none' } },
  },
})

export const SecondaryLinks = styled('p', {
  base: {
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: '4',
    rowGap: '1.5',
    fontSize: 'sm',
    color: 'text.muted',
  },
})

export const InlineLink = styled(Link, {
  base: {
    color: 'text.primary',
    fontWeight: 'medium',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
    _hover: { color: 'accent.default' },
  },
})

export const FeatureGrid = styled('ul', {
  base: {
    display: 'grid',
    gridTemplateColumns: { base: '1fr', sm: 'repeat(3, 1fr)' },
    gap: '3',
    marginTop: '2',
    listStyle: 'none',
  },
})

export const FeatureCard = styled('li', {
  base: {
    display: 'flex',
    flexDirection: { base: 'row', sm: 'column' },
    alignItems: { base: 'center', sm: 'flex-start' },
    gap: '2.5',
    bg: 'bg.surface',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'card',
    boxShadow: 'card',
    px: '3.5',
    py: '3',
    fontSize: 'sm',
    fontWeight: 'medium',
    transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
    _hover: {
      transform: 'translateY(-3px)',
      borderColor: 'accent.default',
      boxShadow: 'lifted',
    },
    _motionReduce: { _hover: { transform: 'none' } },
  },
})

// --- Live standings demo -----------------------------------------------
// A simulated leaderboard that reorders itself on the brand panel. It is the
// clearest one-glance explanation of what the product does, so it earns its
// place over a static screenshot. The same row geometry is reused by the real
// leaderboard on the results screens.

export const StandingsHeader = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '3',
    marginBottom: '3',
    fontSize: 'xs',
    fontWeight: 'semibold',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.85)',
  },
})

export const LiveLabel = styled('span', {
  base: { display: 'inline-flex', alignItems: 'center', gap: '2' },
})

export const LiveDot = styled('span', {
  base: {
    width: '2',
    height: '2',
    borderRadius: 'pill',
    bg: 'green.300',
    animation: 'pulseDot 1.6s ease-in-out infinite',
    _motionReduce: { animation: 'none' },
  },
})

export const StandingsList = styled('div', {
  base: { position: 'relative' },
})

export const StandingRow = styled('div', {
  base: {
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    display: 'flex',
    alignItems: 'center',
    gap: '3',
    px: '3',
    borderRadius: 'control',
    borderWidth: '1px',
    borderColor: 'transparent',
    bg: 'rgba(255, 255, 255, 0.12)',
    transition: 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.35s ease',
    _motionReduce: { transition: 'none' },
  },
  variants: {
    leading: {
      true: {
        bg: 'rgba(255, 255, 255, 0.26)',
        borderColor: 'rgba(255, 255, 255, 0.45)',
      },
    },
  },
})

export const RankBadge = styled('span', {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '6',
    height: '6',
    flexShrink: '0',
    borderRadius: 'control',
    bg: 'rgba(0, 0, 0, 0.18)',
    fontSize: 'xs',
    fontWeight: 'bold',
  },
  variants: {
    leading: {
      true: { bg: 'white', color: 'brand.600' },
    },
  },
})

export const TeamName = styled('span', {
  base: {
    flex: '1',
    minWidth: '0',
    fontSize: 'sm',
    fontWeight: 'medium',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

export const TeamScore = styled('span', {
  base: {
    fontSize: 'sm',
    fontWeight: 'semibold',
    fontVariantNumeric: 'tabular-nums',
  },
})
