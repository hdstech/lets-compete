import { supabase } from '../../lib/supabase'
import type { RoundRow } from './types'

// Supabase/PostgREST errors (PostgrestError) are plain objects, not Error
// instances, so callers can't rely on `err instanceof Error` to read a
// meaningful message (e.g. a raised trigger exception) out of a catch block.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}

export async function listRounds(eventId: string): Promise<RoundRow[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('event_id', eventId)
    .order('sequence', { ascending: true })

  if (error) throw error
  return data as RoundRow[]
}

export async function getRound(roundId: string): Promise<RoundRow> {
  const { data, error } = await supabase.from('rounds').select('*').eq('id', roundId).single()

  if (error) throw error
  return data as RoundRow
}

export type RoundInput = {
  name: string
  sequence: number
  isFinalRound: boolean
  advancementN: number | null
}

export async function createRound(eventId: string, input: RoundInput): Promise<RoundRow> {
  const { data, error } = await supabase
    .from('rounds')
    .insert({
      event_id: eventId,
      name: input.name,
      sequence: input.sequence,
      is_final_round: input.isFinalRound,
      advancement_n: input.isFinalRound ? null : input.advancementN,
    })
    .select()
    .single()

  if (error) throw error
  return data as RoundRow
}

export async function updateRound(roundId: string, input: RoundInput): Promise<RoundRow> {
  const { data, error } = await supabase
    .from('rounds')
    .update({
      name: input.name,
      sequence: input.sequence,
      is_final_round: input.isFinalRound,
      advancement_n: input.isFinalRound ? null : input.advancementN,
    })
    .eq('id', roundId)
    .select()
    .single()

  if (error) throw error
  return data as RoundRow
}

export async function deleteRound(roundId: string): Promise<void> {
  const { error } = await supabase.from('rounds').delete().eq('id', roundId)
  if (error) throw error
}
