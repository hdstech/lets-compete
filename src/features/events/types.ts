export type EventFormat = 'quiz' | 'judged'
export type EventStatus = 'draft' | 'active' | 'concluded'

export type EventRow = {
  id: string
  name: string
  event_date: string | null
  organizer_id: string
  format: EventFormat
  status: EventStatus
  has_rounds: boolean
  grader_id: string | null
  winner_participant_id: string | null
  concluded_at: string | null
  join_code: string
  created_at: string
}
