import type { RoundStatus } from './types'

// A round's state, as a badge tone and a human label. Shared by the rounds
// list and the live console so a round never looks like two different things
// on two screens.
export const ROUND_STATUS_TONE: Record<
  RoundStatus,
  'neutral' | 'accent' | 'success' | 'warning'
> = {
  pending: 'neutral',
  scoring_open: 'accent',
  scoring_closed: 'warning',
  advanced: 'success',
}

export function roundStatusLabel(status: RoundStatus): string {
  return status.replace('_', ' ')
}
