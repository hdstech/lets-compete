import { styled } from '../../../styled-system/jsx'

// The shell for the two screens a player or judge actually holds in their
// hand: the waiting room and the live answer screen. Phone-first — a single
// column that never exceeds a comfortable reading width on a tablet — with
// the brand gradient as its header so a magic-link arrival lands somewhere
// recognisably part of the same product as the page that invited them.
export const PlayerShell = styled('main', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100dvh',
    width: 'full',
    maxWidth: '32rem',
    mx: 'auto',
    bg: 'bg.canvas',
    color: 'text.primary',
    overflowX: 'hidden',
    paddingLeft: 'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)',
  },
})

export const PlayerBody = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4',
    flex: '1',
    px: { base: '4', sm: '6' },
    pt: { base: '5', sm: '6' },
    pb: '4',
  },
})

// A pill that reads correctly on the gradient, where the app's tinted badges
// would lose their contrast.
export const PlayerHeaderBadge = styled('span', {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1.5',
    borderRadius: 'pill',
    bg: 'rgba(255, 255, 255, 0.2)',
    borderWidth: '1px',
    borderColor: 'rgba(255, 255, 255, 0.38)',
    px: '2.5',
    py: '1',
    fontSize: 'xs',
    fontWeight: 'semibold',
    textTransform: 'capitalize',
    color: 'white',
  },
})
