import { supabase } from '../../lib/supabase'
import type { QuestionRow } from '../questions/types'
import type { TiebreakEntrantRow, TiebreakQuestionRow, TiebreakRow } from './types'

// Supabase/PostgREST errors (PostgrestError) are plain objects, not Error
// instances, so callers can't rely on `err instanceof Error` to read a
// meaningful message (e.g. a raised RPC exception) out of a catch block.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}

// Most recent first, so callers can treat index 0 as "the current attempt"
// (a round only ever has one tiebreak per calculation in practice, but
// nothing stops a stale earlier attempt from also existing).
export async function listTiebreaksForRound(roundId: string): Promise<TiebreakRow[]> {
  const { data, error } = await supabase
    .from('tiebreaks')
    .select('*')
    .eq('round_id', roundId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as TiebreakRow[]
}

export async function listTiebreakEntrants(tiebreakId: string): Promise<TiebreakEntrantRow[]> {
  const { data, error } = await supabase
    .from('tiebreak_entrants')
    .select('*')
    .eq('tiebreak_id', tiebreakId)

  if (error) throw error
  return data as TiebreakEntrantRow[]
}

export async function listTiebreakQuestions(tiebreakId: string): Promise<TiebreakQuestionRow[]> {
  const { data, error } = await supabase
    .from('tiebreak_questions')
    .select('*')
    .eq('tiebreak_id', tiebreakId)
    .order('sequence', { ascending: true })

  if (error) throw error
  return data as TiebreakQuestionRow[]
}

// Opens a sudden-death tiebreak for the round: scope/cutoff are inferred
// server-side from is_final_round, read from the round's own final
// calculate_results entries. Raises if there's no genuine tie at the cutoff.
export async function startTiebreak(roundId: string): Promise<TiebreakRow> {
  const { data, error } = await supabase.rpc('start_tiebreak', { p_round_id: roundId })
  if (error) throw error
  return data as TiebreakRow
}

// Draws and immediately reveals the next reserve question. Returns null
// (not an error) once the pool is exhausted — the tiebreak flips to
// 'exhausted' server-side; callers should reload the tiebreak row after.
export async function drawTiebreakQuestion(tiebreakId: string): Promise<QuestionRow | null> {
  const { data, error } = await supabase.rpc('draw_tiebreak_question', {
    p_tiebreak_id: tiebreakId,
  })
  if (error) throw error
  return data as QuestionRow | null
}

export async function voidTiebreakQuestion(tiebreakId: string): Promise<QuestionRow> {
  const { data, error } = await supabase.rpc('void_tiebreak_question', {
    p_tiebreak_id: tiebreakId,
  })
  if (error) throw error
  return data as QuestionRow
}

// Requires the currently drawn question fully graded first (raises
// otherwise, pointing at the grading screen). No clean cut: stays open,
// ready for another draw. Clean cut: entrant outcomes are written and the
// tiebreak flips to 'resolved'.
export async function resolveTiebreakQuestion(tiebreakId: string): Promise<TiebreakRow> {
  const { data, error } = await supabase.rpc('resolve_tiebreak_question', {
    p_tiebreak_id: tiebreakId,
  })
  if (error) throw error
  return data as TiebreakRow
}
