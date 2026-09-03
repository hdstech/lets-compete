import { supabase } from '../../lib/supabase'
import type { ResultCalculationEntryRow, ResultCalculationRow } from './types'

// Supabase/PostgREST errors (PostgrestError) are plain objects, not Error
// instances, so callers can't rely on `err instanceof Error` to read a
// meaningful message (e.g. a raised RPC exception) out of a catch block.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}

// Only the current (is_final) calculation per scope — history is T29.
export async function listFinalCalculations(eventId: string): Promise<ResultCalculationRow[]> {
  const { data, error } = await supabase
    .from('result_calculations')
    .select('*')
    .eq('event_id', eventId)
    .eq('is_final', true)

  if (error) throw error
  return data as ResultCalculationRow[]
}

export async function listCalculationEntries(
  calculationIds: string[],
): Promise<ResultCalculationEntryRow[]> {
  if (calculationIds.length === 0) return []

  const { data, error } = await supabase
    .from('result_calculation_entries')
    .select('*')
    .in('calculation_id', calculationIds)
    .order('rank', { ascending: true })

  if (error) throw error
  return data as ResultCalculationEntryRow[]
}

// Calculates one scope: per-segment (round_id + segment_id), per-round
// (round_id, segment_id null), or event-overall (both null — resolves to
// the final round server-side). Callers must always re-read the frozen
// result_calculation_entries afterwards rather than deriving totals from
// this call's return value — the header alone doesn't carry the entries.
export async function calculateResults(
  eventId: string,
  roundId: string | null,
  segmentId: string | null,
): Promise<ResultCalculationRow> {
  const { data, error } = await supabase.rpc('calculate_results', {
    p_event_id: eventId,
    p_round_id: roundId,
    p_segment_id: segmentId,
  })

  if (error) throw error
  return data as ResultCalculationRow
}
