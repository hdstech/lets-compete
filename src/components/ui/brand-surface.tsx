import { styled } from '../../../styled-system/jsx'

// The blue gradient introduced by the landing page, extracted so every
// brand-facing surface draws it from one place: the landing hero, the panel
// beside the auth cards, and the header of the participant/judge screens.
//
// Its colours are fixed across light and dark on purpose — this is the one
// surface in the app with an identity of its own, and a themed version of it
// would read as a different brand rather than the same one after dark.
export const BrandSurface = styled('section', {
  base: {
    position: 'relative',
    isolation: 'isolate',
    overflow: 'hidden',
    color: 'white',
    backgroundImage:
      'linear-gradient(158deg, token(colors.brand.500) 0%, token(colors.brand.500) 46%, token(colors.brand.400) 100%)',
  },
  variants: {
    layout: {
      // The landing page's half of the screen.
      hero: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '10',
        px: { base: '6', md: '10', lg: '12' },
        paddingTop: 'max(2rem, env(safe-area-inset-top))',
        paddingBottom: { base: '10', lg: '12' },
        lg: { paddingLeft: 'max(3rem, env(safe-area-inset-left))' },
      },
      // Beside an auth card: the same panel, quieter, and it collapses to a
      // short banner above the form on a phone.
      aside: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '8',
        px: { base: '6', md: '10' },
        paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
        paddingBottom: { base: '8', lg: '10' },
      },
      // A full-width strip at the top of a participant or judge screen.
      banner: {
        display: 'flex',
        flexDirection: 'column',
        gap: '3',
        px: { base: '5', sm: '6' },
        paddingTop: 'max(1.25rem, env(safe-area-inset-top))',
        paddingBottom: '5',
      },
    },
  },
  defaultVariants: { layout: 'banner' },
})

// Soft drifting light sources. Purely decorative, so they sit behind the
// content and never intercept pointer events.
export const BrandGlow = styled('div', {
  base: {
    position: 'absolute',
    zIndex: '-1',
    pointerEvents: 'none',
    borderRadius: 'pill',
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
      // Sized for the short banner, where a full-height glow would spill.
      trailing: {
        width: '14rem',
        height: '14rem',
        top: '-5rem',
        right: '-3rem',
        bg: 'rgba(255, 255, 255, 0.24)',
      },
    },
  },
})

// Faint scoreboard grid, faded out toward the bottom so it never competes
// with the content sitting on top of it.
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

export const BrandWordmark = styled('div', {
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

export const BrandWordmarkBadge = styled('span', {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '9',
    height: '9',
    flexShrink: '0',
    borderRadius: 'control',
    bg: 'rgba(255, 255, 255, 0.2)',
    borderWidth: '1px',
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
})

// Headline set on the gradient. `hero` is the landing page's display size;
// `panel` is the smaller version used beside a form or above a phone screen.
export const BrandHeadline = styled('h1', {
  base: {
    fontWeight: 'bold',
    letterSpacing: '-0.03em',
    lineHeight: '0.95',
    textWrap: 'balance',
    animation: 'riseIn 0.7s ease-out both',
    _motionReduce: { animation: 'none' },
  },
  variants: {
    size: {
      hero: { fontSize: 'clamp(3rem, 9vw, 5.5rem)' },
      panel: { fontSize: 'clamp(2rem, 5vw, 3rem)' },
      banner: { fontSize: { base: '2xl', sm: '3xl' }, lineHeight: '1.05' },
    },
  },
  defaultVariants: { size: 'hero' },
})

export const BrandText = styled('p', {
  base: {
    maxWidth: '34ch',
    fontSize: { base: 'md', md: 'lg' },
    color: 'rgba(255, 255, 255, 0.88)',
    animation: 'riseIn 0.7s ease-out 0.1s both',
    _motionReduce: { animation: 'none' },
  },
  variants: {
    size: {
      md: {},
      sm: { fontSize: 'sm', maxWidth: '40ch' },
    },
  },
  defaultVariants: { size: 'md' },
})

// A glass chip for content laid over the gradient — the landing standings
// card, and the meta rows on a participant banner.
export const BrandGlassPanel = styled('div', {
  base: {
    bg: 'rgba(255, 255, 255, 0.14)',
    borderWidth: '1px',
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 'card',
    backdropFilter: 'blur(12px)',
    p: '4',
  },
  variants: {
    entrance: {
      true: {
        animation: 'riseIn 0.7s ease-out 0.2s both',
        _motionReduce: { animation: 'none' },
      },
    },
  },
})
