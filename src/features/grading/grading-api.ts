import { supabase } from '../../lib/supabase'
import type { AnswerRow, ParticipantRow } from '../live-quiz/types'

export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}

export async function listAnswersForRound(roundId: string): Promise<AnswerRow[]> {
  const { data, error } = await supabase.from('answers').select('*').eq('round_id', roundId)

  if (error) throw error
  return data as AnswerRow[]
}

// Round 1's roster is never seeded into round_participants (T16's
// result_scope_totals comment: "nothing seeds round 1's rows yet" — it
// treats an unseeded round as every approved participant being active), so
// the grading screen can't resolve answerers via round_participants the way
// the live console's who's-answered roster does. Looking participants up
// directly by the ids that actually appear on this round's answers works
// for every round, seeded or not.
export async function listParticipantsByIds(participantIds: string[]): Promise<ParticipantRow[]> {
  if (participantIds.length === 0) return []

  const { data, error } = await supabase.from('participants').select('*').in('id', participantIds)

  if (error) throw error
  return data as ParticipantRow[]
}

export type GraderDecision = { answer_id: string; final_correct: boolean }

export async function adjudicateRoundAnswers(
  roundId: string,
  grades: GraderDecision[],
): Promise<AnswerRow[]> {
  const { data, error } = await supabase.rpc('adjudicate_round_answers', {
    p_round_id: roundId,
    p_grades: grades,
  })

  if (error) throw error
  return data as AnswerRow[]
}
