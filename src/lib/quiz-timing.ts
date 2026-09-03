// Shared deadline math for any screen that renders a question's
// server-authoritative answer window (QA5): admin's LiveConsolePage and the
// participant's LiveAnswerPage must never disagree on when a window closes,
// so both derive it from this one place rather than each computing it
// independently.
export function getDeadlineMs(question: {
  revealed_at: string | null
  window_seconds: number
}): number | null {
  if (!question.revealed_at) return null
  return new Date(question.revealed_at).getTime() + question.window_seconds * 1000
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
