import { styled } from '../../../styled-system/jsx'

export const RoundSection = styled('section', {
  base: { display: 'flex', flexDirection: 'column', gap: '4' },
})

export const BoardHeader = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '3',
    flexWrap: 'wrap',
  },
})

export const BoardMeta = styled('span', {
  base: { fontSize: 'xs', color: 'text.placeholder' },
})

export const BoardTable = styled('table', {
  base: { width: 'full', borderCollapse: 'collapse', fontSize: 'sm' },
})

export const BoardHeadCell = styled('th', {
  base: {
    textAlign: 'left',
    color: 'text.placeholder',
    fontSize: 'xs',
    fontWeight: 'semibold',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    pb: '2',
    borderBottomWidth: '1px',
    borderColor: 'border.default',
  },
  variants: {
    numeric: {
      true: { textAlign: 'right' },
    },
  },
})

// The leaderboard rows echo the landing page's standings card: the leader is
// lifted out of the list with the accent tint, everyone else stays quiet.
export const BoardRow = styled('tr', {
  base: {
    transition: 'background-color 0.18s ease',
    _hover: { bg: 'bg.sunken' },
  },
  variants: {
    leading: {
      true: { bg: 'accent.subtle', _hover: { bg: 'accent.subtle' } },
    },
  },
})

export const BoardCell = styled('td', {
  base: {
    py: '2',
    px: '2',
    borderBottomWidth: '1px',
    borderColor: 'border.default',
    color: 'text.primary',
    _first: { pl: '0' },
    _last: { pr: '0' },
  },
  variants: {
    numeric: {
      true: {
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 'semibold',
      },
    },
  },
})

export const RankCell = styled('td', {
  base: {
    py: '2',
    pl: '0',
    pr: '2',
    width: '10',
    borderBottomWidth: '1px',
    borderColor: 'border.default',
  },
})

// A numbered tile rather than a bare digit — the same shape the landing
// standings and the icon tiles use elsewhere.
export const RankTile = styled('span', {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '7',
    height: '7',
    borderRadius: 'control',
    bg: 'bg.sunken',
    color: 'text.muted',
    fontSize: 'xs',
    fontWeight: 'bold',
    fontVariantNumeric: 'tabular-nums',
  },
  variants: {
    leading: {
      true: { bg: 'accent.solid', color: 'accent.onSolid' },
    },
  },
})
