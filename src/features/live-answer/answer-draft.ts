// A participant's in-progress answer is autosaved here as they type, keyed
// per question, so a reload or brief disconnect during a live question
// doesn't lose typed-but-unsubmitted text. This is a client-side-only
// concept — QA6's submit_answer RPC is the only server write path, and
// nothing here calls it; LiveAnswerPage decides when to actually submit.
const STORAGE_PREFIX = 'qb4.answerDraft.'

export function getAnswerDraft(questionId: string): string | null {
  return localStorage.getItem(STORAGE_PREFIX + questionId)
}

export function setAnswerDraft(questionId: string, text: string): void {
  localStorage.setItem(STORAGE_PREFIX + questionId, text)
}

export function clearAnswerDraft(questionId: string): void {
  localStorage.removeItem(STORAGE_PREFIX + questionId)
}
