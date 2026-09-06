import { getErrorMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { RoundRow } from './types'

export { getErrorMessage }

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

// Advances a scoring_closed, non-final round: writes advanced/eliminated
// round_participants from its final calculate_results entries and opens the
// next round. Raises server-side if called on the final round (declareWinner
// is the equivalent there) or before results have been calculated.
export async function advanceRound(roundId: string): Promise<RoundRow> {
  const { data, error } = await supabase.rpc('advance_round', { p_round_id: roundId })
  if (error) throw error
  return data as RoundRow
}
