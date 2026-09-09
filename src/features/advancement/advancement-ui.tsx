import { styled } from '../../../styled-system/jsx'

// Outcome maps onto the shared badge tones; the component itself lives in
// components/ui/Badge.
export const OUTCOME_TONE = {
  advanced: 'success',
  eliminated: 'danger',
  pending: 'warning',
} as const

export const Countdown = styled('div', {
  base: {
    fontSize: '2xl',
    fontWeight: 'bold',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.02em',
    color: 'accent.default',
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
