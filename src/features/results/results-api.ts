import { supabase } from '../../lib/supabase'
import type { ResultCalculationEntryRow, ResultCalculationRow } from './types'

// Keys a scope the same way result_calculations' one-final-per-scope index
// does: round_id/segment_id null-ness distinguishes segment / round / event
// scopes (see the T16 migration's comment).
export function scopeKey(roundId: string | null, segmentId: string | null): string {
  return `${roundId ?? 'none'}:${segmentId ?? 'none'}`
}

// Supabase/PostgREST errors (PostgrestError) are plain objects, not Error
// instances, so callers can't rely on `err instanceof Error` to read a
// meaningful message (e.g. a raised RPC exception) out of a catch block.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}

// Only the current (is_final) calculation per scope.
export async function listFinalCalculations(eventId: string): Promise<ResultCalculationRow[]> {
  const { data, error } = await supabase
    .from('result_calculations')
    .select('*')
    .eq('event_id', eventId)
    .eq('is_final', true)

  if (error) throw error
  return data as ResultCalculationRow[]
}

// Every calculation ever run for the event, superseded ones included —
// the calculation history.
export async function listAllCalculations(eventId: string): Promise<ResultCalculationRow[]> {
  const { data, error } = await supabase
    .from('result_calculations')
    .select('*')
    .eq('event_id', eventId)
    .order('calculated_at', { ascending: false })

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
  reason: string | null = null,
): Promise<ResultCalculationRow> {
  const { data, error } = await supabase.rpc('calculate_results', {
    p_event_id: eventId,
    p_round_id: roundId,
    p_segment_id: segmentId,
    p_reason: reason,
  })

  if (error) throw error
  return data as ResultCalculationRow
}

// Re-runs calculate_results for every scope that currently has a final
// (is_final) calculation, tagging each with `reason` — the "recalc after
// revoke/DQ" action: a participant's status/admission change doesn't retroactively
// touch any already-written result_calculations row (those are immutable),
// so scopes only reflect it once someone re-runs the calculation. Scopes
// that were never calculated in the first place are left alone; there's
// nothing stale to refresh. Returns the number of scopes re-calculated.
export async function recalculateAffectedScopes(
  eventId: string,
  reason: string,
): Promise<number> {
  const finalCalcs = await listFinalCalculations(eventId)
  for (const calc of finalCalcs) {
    await calculateResults(eventId, calc.round_id, calc.segment_id, reason)
  }
  return finalCalcs.length
}
