import { supabase } from '../../lib/supabase'
import { listQuestions } from '../questions/questions-api'
import type { QuestionRow } from '../questions/types'
import { listSegments } from '../segments/segments-api'
import type { SegmentRow } from '../segments/types'
import type { AnswerRow, IntegrityEventRow, RoundParticipantRow } from './types'

// Supabase/PostgREST errors (PostgrestError) are plain objects, not Error
// instances, so callers can't rely on `err instanceof Error` to read a
// meaningful message (e.g. a raised RPC exception) out of a catch block.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}

export type RoundQuestion = QuestionRow & { segment_name: string }

// Questions are authored per-segment, but the live console reveals across a
// round in one flat running order (segment.sequence, then question.sequence)
// — segments aren't a scoring boundary participants ever see live.
export async function listRoundQuestions(roundId: string): Promise<RoundQuestion[]> {
  const segments = await listSegments(roundId)
  const bySegmentId = new Map<string, SegmentRow>(segments.map((s) => [s.id, s]))

  const questionLists = await Promise.all(segments.map((s) => listQuestions(s.id)))

  return questionLists
    .flat()
    .map((q) => ({ ...q, segment_name: bySegmentId.get(q.segment_id)!.name }))
    .sort((a, b) => {
      const seqA = bySegmentId.get(a.segment_id)!.sequence
      const seqB = bySegmentId.get(b.segment_id)!.sequence
      return seqA - seqB || a.sequence - b.sequence
    })
}

export async function listActiveRoundParticipants(roundId: string): Promise<RoundParticipantRow[]> {
  const { data, error } = await supabase
    .from('round_participants')
    .select('*, participant:participants(*)')
    .eq('round_id', roundId)
    .eq('status', 'active')

  if (error) throw error
  return data as unknown as RoundParticipantRow[]
}

export async function listAnswersForQuestions(questionIds: string[]): Promise<AnswerRow[]> {
  if (questionIds.length === 0) return []

  const { data, error } = await supabase.from('answers').select('*').in('question_id', questionIds)

  if (error) throw error
  return data as AnswerRow[]
}

export async function listIntegrityEventsForQuestions(
  questionIds: string[],
): Promise<IntegrityEventRow[]> {
  if (questionIds.length === 0) return []

  const { data, error } = await supabase
    .from('integrity_events')
    .select('*')
    .in('question_id', questionIds)
    .order('occurred_at', { ascending: true })

  if (error) throw error
  return data as IntegrityEventRow[]
}

export async function revealQuestion(questionId: string): Promise<QuestionRow> {
  const { data, error } = await supabase.rpc('reveal_question', { p_question_id: questionId })
  if (error) throw error
  return data as QuestionRow
}

export async function closeQuestionWindow(questionId: string): Promise<QuestionRow> {
  const { data, error } = await supabase.rpc('close_question_window', { p_question_id: questionId })
  if (error) throw error
  return data as QuestionRow
}

export async function voidQuestion(questionId: string): Promise<QuestionRow> {
  const { data, error } = await supabase.rpc('void_question', { p_question_id: questionId })
  if (error) throw error
  return data as QuestionRow
}

export async function closeRound(roundId: string): Promise<void> {
  const { error } = await supabase.rpc('close_round', { p_round_id: roundId })
  if (error) throw error
}
