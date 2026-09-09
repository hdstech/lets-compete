import type { QuestionStatus } from './types'

// A question's live state as a badge tone, shared by the live console's
// current-question card and its running order list.
export const QUESTION_STATUS_TONE: Record<
  QuestionStatus,
  'neutral' | 'accent' | 'success' | 'warning' | 'danger'
> = {
  pending: 'neutral',
  revealed: 'accent',
  window_open: 'accent',
  window_closed: 'success',
  voided: 'danger',
}

export function questionStatusLabel(status: QuestionStatus): string {
  return status.replace('_', ' ')
}
