import { getErrorMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { ParticipantRow, ParticipantType } from './types'

export { getErrorMessage }

export async function joinEvent(
  joinCode: string,
  name: string,
  type: ParticipantType,
  members?: string,
): Promise<ParticipantRow> {
  const { data, error } = await supabase.rpc('join_event', {
    p_join_code: joinCode,
    p_name: name,
    p_type: type,
    p_members: members ?? null,
  })

  if (error) throw error
  return data as ParticipantRow
}

// Direct-select re-fetch of the caller's own row for an event already known
// by id (e.g. the waiting room on reload). RLS's participants_select policy
// covers user_id = auth.uid(), so this doesn't need a join_code the way the
// my_participant_identity RPC does.
export async function getMyParticipant(
  eventId: string,
  userId: string,
): Promise<ParticipantRow | null> {
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data as ParticipantRow | null
}

export async function listEventParticipants(eventId: string): Promise<ParticipantRow[]> {
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as ParticipantRow[]
}

export async function approveParticipant(participantId: string): Promise<ParticipantRow> {
  const { data, error } = await supabase.rpc('approve_participant', {
    p_participant_id: participantId,
  })

  if (error) throw error
  return data as ParticipantRow
}

export async function revokeParticipant(participantId: string): Promise<ParticipantRow> {
  const { data, error } = await supabase.rpc('revoke_participant', {
    p_participant_id: participantId,
  })

  if (error) throw error
  return data as ParticipantRow
}

export async function disqualifyParticipant(participantId: string): Promise<ParticipantRow> {
  const { data, error } = await supabase.rpc('disqualify_participant', {
    p_participant_id: participantId,
  })

  if (error) throw error
  return data as ParticipantRow
}

export async function reinstateParticipant(participantId: string): Promise<ParticipantRow> {
  const { data, error } = await supabase.rpc('reinstate_participant', {
    p_participant_id: participantId,
  })

  if (error) throw error
  return data as ParticipantRow
}
