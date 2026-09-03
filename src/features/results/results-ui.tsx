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
    textTransform: 'uppercase',
    letterSpacing: 'wide',
    pb: '2',
    borderBottomWidth: '1px',
    borderColor: 'border.default',
  },
})

export const BoardCell = styled('td', {
  base: {
    py: '1.5',
    borderBottomWidth: '1px',
    borderColor: 'border.default',
    color: 'text.primary',
  },
})

export const RankCell = styled('td', {
  base: {
    py: '1.5',
    borderBottomWidth: '1px',
    borderColor: 'border.default',
    color: 'text.muted',
    fontVariantNumeric: 'tabular-nums',
  },
})
