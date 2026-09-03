import { styled } from '../../../styled-system/jsx'

export const OutcomeBadge = styled('span', {
  base: {
    fontSize: 'xs',
    fontWeight: 'semibold',
    borderRadius: 'full',
    px: '2.5',
    py: '1',
    textTransform: 'capitalize',
  },
  variants: {
    outcome: {
      advanced: { bg: 'green.700', color: 'green.50' },
      eliminated: { bg: 'red.700', color: 'red.50' },
      pending: { bg: 'amber.700', color: 'amber.50' },
    },
  },
})

export const Countdown = styled('div', {
  base: {
    fontSize: '2xl',
    fontWeight: 'bold',
    fontVariantNumeric: 'tabular-nums',
    color: 'text.primary',
  },
})

export const DrawHistoryList = styled('ol', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5',
    fontSize: 'sm',
    color: 'text.muted',
    pl: '4',
  },
})
