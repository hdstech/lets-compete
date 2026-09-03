import { supabase } from '../../lib/supabase'
import type { EventFormat, EventRow } from './types'

// Supabase/PostgREST errors (PostgrestError) are plain objects, not Error
// instances, so callers can't rely on `err instanceof Error` to read a
// meaningful message (e.g. a raised RPC exception) out of a catch block.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}

export async function listOrganizerEvents(organizerId: string): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as EventRow[]
}

export async function getEvent(eventId: string): Promise<EventRow> {
  const { data, error } = await supabase.from('events').select('*').eq('id', eventId).single()

  if (error) throw error
  return data as EventRow
}

export type CreateEventInput = {
  name: string
  eventDate: string | null
  format: EventFormat
  hasRounds: boolean
  organizerId: string
}

export async function createEvent(input: CreateEventInput): Promise<EventRow> {
  // Insert and read-back are split into two requests: Postgres raises a
  // false-negative RLS violation on INSERT ... RETURNING here (the
  // self-referential events_select_member check doesn't see the row the
  // same INSERT command just wrote), even though the row is fully readable
  // right after. A plain insert followed by a separate select sidesteps it.
  const id = crypto.randomUUID()

  const { error } = await supabase.from('events').insert({
    id,
    name: input.name,
    event_date: input.eventDate,
    format: input.format,
    has_rounds: input.hasRounds,
    organizer_id: input.organizerId,
  })

  if (error) throw error
  return getEvent(id)
}

export type UpdateEventInput = {
  name: string
  eventDate: string | null
  hasRounds: boolean
}

export async function updateEvent(eventId: string, input: UpdateEventInput): Promise<EventRow> {
  const { data, error } = await supabase
    .from('events')
    .update({ name: input.name, event_date: input.eventDate, has_rounds: input.hasRounds })
    .eq('id', eventId)
    .select()
    .single()

  if (error) throw error
  return data as EventRow
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', eventId)
  if (error) throw error
}

export async function activateEvent(eventId: string): Promise<EventRow> {
  const { data, error } = await supabase.rpc('activate_event', { p_event_id: eventId })
  if (error) throw error
  return data as EventRow
}

export async function concludeEvent(eventId: string): Promise<EventRow> {
  const { data, error } = await supabase.rpc('conclude_event', { p_event_id: eventId })
  if (error) throw error
  return data as EventRow
}

export async function assignGrader(eventId: string, email: string): Promise<EventRow> {
  const { data, error } = await supabase.rpc('assign_grader', {
    p_event_id: eventId,
    p_email: email,
  })
  if (error) throw error
  return data as EventRow
}
