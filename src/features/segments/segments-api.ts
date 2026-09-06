import { getErrorMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { SegmentRow } from './types'

export { getErrorMessage }

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
