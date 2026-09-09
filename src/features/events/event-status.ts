import type { EventStatus } from './types'

// One mapping from an event's lifecycle state to a badge tone, shared by the
// events list and the event detail header so they can never drift apart.
export const EVENT_STATUS_TONE: Record<EventStatus, 'neutral' | 'success' | 'accent'> = {
  draft: 'neutral',
  active: 'success',
  concluded: 'accent',
}
