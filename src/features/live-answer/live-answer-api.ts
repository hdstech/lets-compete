import { supabase } from '../../lib/supabase'
import type { AnswerRow } from '../live-quiz/types'

// Supabase/PostgREST errors (PostgrestError) are plain objects, not Error
// instances, so callers can't rely on `err instanceof Error` to read a
// meaningful message (e.g. a raised RPC exception) out of a catch block.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}

// Re-fetches the caller's own answer for a question (e.g. after a reload,
// to show what was already submitted). RLS's answers_select policy covers
// owns_participant, so this only ever returns the caller's own row.
export async function getMyAnswer(
  participantId: string,
  questionId: string,
): Promise<AnswerRow | null> {
  const { data, error } = await supabase
    .from('answers')
    .select('*')
    .eq('participant_id', participantId)
    .eq('question_id', questionId)
    .maybeSingle()

  if (error) throw error
  return data as AnswerRow | null
}

export async function submitAnswer(
  questionId: string,
  submittedText: string,
  clientElapsedMs: number,
  revealToken: string,
): Promise<AnswerRow> {
  const { data, error } = await supabase.rpc('submit_answer', {
    p_question_id: questionId,
    p_submitted_text: submittedText,
    p_client_elapsed_ms: clientElapsedMs,
    p_reveal_token: revealToken,
    p_is_saved_draft: false,
  })

  if (error) throw error
  return data as AnswerRow
}
