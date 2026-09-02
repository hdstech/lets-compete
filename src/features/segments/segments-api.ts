import { supabase } from '../../lib/supabase'
import type { SegmentRow } from './types'

// Supabase/PostgREST errors (PostgrestError) are plain objects, not Error
// instances, so callers can't rely on `err instanceof Error` to read a
// meaningful message (e.g. a raised trigger exception) out of a catch block.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}

export async function listSegments(roundId: string): Promise<SegmentRow[]> {
  const { data, error } = await supabase
    .from('segments')
    .select('*')
    .eq('round_id', roundId)
    .order('sequence', { ascending: true })

  if (error) throw error
  return data as SegmentRow[]
}

export async function getSegment(segmentId: string): Promise<SegmentRow> {
  const { data, error } = await supabase.from('segments').select('*').eq('id', segmentId).single()

  if (error) throw error
  return data as SegmentRow
}

export type SegmentInput = {
  name: string
  sequence: number
}

export async function createSegment(roundId: string, input: SegmentInput): Promise<SegmentRow> {
  const { data, error } = await supabase
    .from('segments')
    .insert({ round_id: roundId, name: input.name, sequence: input.sequence })
    .select()
    .single()

  if (error) throw error
  return data as SegmentRow
}

export async function updateSegment(segmentId: string, input: SegmentInput): Promise<SegmentRow> {
  const { data, error } = await supabase
    .from('segments')
    .update({ name: input.name, sequence: input.sequence })
    .eq('id', segmentId)
    .select()
    .single()

  if (error) throw error
  return data as SegmentRow
}

export async function deleteSegment(segmentId: string): Promise<void> {
  const { error } = await supabase.from('segments').delete().eq('id', segmentId)
  if (error) throw error
}
