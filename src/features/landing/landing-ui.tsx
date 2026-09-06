import { Link } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'

// Two-up marketing layout: a fixed-identity brand panel (its blue gradient is
// the same in both themes) beside an action panel on the ordinary app canvas,
// so the hand-off from here into /login and /signup is seamless.
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

export const BrandPanel = styled('section', {
  base: {
    position: 'relative',
    isolation: 'isolate',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '10',
    color: 'white',
    backgroundImage:
      'linear-gradient(158deg, token(colors.brand.500) 0%, token(colors.brand.500) 46%, token(colors.brand.400) 100%)',
    px: { base: '6', md: '10', lg: '12' },
    paddingTop: 'max(2rem, env(safe-area-inset-top))',
    paddingBottom: { base: '10', lg: '12' },
    lg: { paddingLeft: 'max(3rem, env(safe-area-inset-left))' },
  },
})

// Soft drifting light sources. Purely decorative, so they sit behind the
// content and never intercept pointer events.
export const BrandGlow = styled('div', {
  base: {
    position: 'absolute',
    zIndex: '-1',
    pointerEvents: 'none',
    borderRadius: 'full',
    filter: 'blur(60px)',
    animation: 'drift 18s ease-in-out infinite',
    _motionReduce: { animation: 'none' },
  },
  variants: {
    placement: {
      top: {
        width: '22rem',
        height: '22rem',
        top: '-6rem',
        right: '-4rem',
        bg: 'rgba(255, 255, 255, 0.22)',
      },
      bottom: {
        width: '26rem',
        height: '26rem',
        bottom: '-8rem',
        left: '-6rem',
        bg: 'rgba(63, 111, 189, 0.45)',
        animationDelay: '-9s',
      },
    },
  },
})

// Faint scoreboard grid, faded out toward the bottom so it never competes
// with the leaderboard card sitting on top of it.
export const BrandGrid = styled('div', {
  base: {
    position: 'absolute',
    zIndex: '-1',
    inset: '0',
    pointerEvents: 'none',
    opacity: '0.16',
    backgroundImage:
      'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
    backgroundSize: '56px 56px',
    maskImage: 'linear-gradient(to bottom, black 0%, transparent 78%)',
  },
})

export const Wordmark = styled('div', {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2.5',
    fontSize: 'sm',
    fontWeight: 'semibold',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
})

export const WordmarkBadge = styled('span', {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '9',
    height: '9',
    borderRadius: 'control',
    bg: 'rgba(255, 255, 255, 0.2)',
    borderWidth: '1px',
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
})

export const BrandHeadline = styled('h1', {
  base: {
    fontSize: 'clamp(3rem, 9vw, 5.5rem)',
    lineHeight: '0.95',
    fontWeight: 'bold',
    letterSpacing: '-0.03em',
    textWrap: 'balance',
    animation: 'riseIn 0.7s ease-out both',
    _motionReduce: { animation: 'none' },
  },
})

export const BrandTagline = styled('p', {
  base: {
    maxWidth: '34ch',
    marginTop: '4',
    fontSize: { base: 'md', md: 'lg' },
    color: 'rgba(255, 255, 255, 0.88)',
    animation: 'riseIn 0.7s ease-out 0.1s both',
    _motionReduce: { animation: 'none' },
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

export const ThemeToggle = styled('button', {
  base: {
    position: 'absolute',
    top: '5',
    right: '5',
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
    transition: 'color 0.15s ease, border-color 0.15s ease',
    _hover: { color: 'text.primary', borderColor: 'text.muted' },
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'accent.default',
      outlineOffset: '2px',
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
    px: '3.5',
    py: '3',
    fontSize: 'sm',
    fontWeight: 'medium',
    transition: 'transform 0.18s ease, border-color 0.18s ease',
    _hover: { transform: 'translateY(-3px)', borderColor: 'brand.500' },
    _motionReduce: { _hover: { transform: 'none' } },
  },
})

export const FeatureIcon = styled('span', {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '8',
    height: '8',
    borderRadius: 'control',
    bg: 'brand.500',
    color: 'white',
    flexShrink: '0',
  },
})

// --- Live standings demo -----------------------------------------------
// A simulated leaderboard that reorders itself on the brand panel. It is the
// clearest one-glance explanation of what the product does, so it earns its
// place over a static screenshot.

export const StandingsCard = styled('div', {
  base: {
    width: 'full',
    maxWidth: '26rem',
    bg: 'rgba(255, 255, 255, 0.14)',
    borderWidth: '1px',
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 'card',
    backdropFilter: 'blur(12px)',
    p: '4',
    animation: 'riseIn 0.7s ease-out 0.2s both',
    _motionReduce: { animation: 'none' },
  },
})

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
    borderRadius: 'full',
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
