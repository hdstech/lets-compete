import type { AnswerType } from './types'

export const ANSWER_TYPES: readonly AnswerType[] = ['text', 'numeric', 'boolean']

// A True/False question is stored as a normal question whose single
// acceptable answer is the literal text 'True' or 'False' — the DB matcher
// (private.normalize_answer_text) lowercases both sides, so no special
// grading path is needed. These are the only two values the authoring UI
// will write, and the only two the player screen submits.
export const BOOLEAN_ANSWER_VALUES = ['True', 'False'] as const
export type BooleanAnswerValue = (typeof BOOLEAN_ANSWER_VALUES)[number]

// Reads an existing acceptable-answer row (or a submitted answer) back as a
// True/False choice, tolerating the casing and padding of anything authored
// before this UI existed. Returns null when the text isn't either value.
export function parseBooleanAnswer(value: string): BooleanAnswerValue | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return 'True'
  if (normalized === 'false') return 'False'
  return null
}

// How an answer type reads to a human. The enum labels are storage names;
// 'boolean' in particular is meaningless to an organizer or a player.
export const ANSWER_TYPE_LABELS: Record<AnswerType, string> = {
  text: 'Text',
  numeric: 'Numeric',
  boolean: 'True/False',
}

export function answerTypeLabel(answerType: AnswerType): string {
  return ANSWER_TYPE_LABELS[answerType]
}
