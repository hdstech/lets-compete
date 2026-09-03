export type ParticipantType = 'individual' | 'team'
export type ParticipantStatus = 'eligible' | 'disqualified' | 'withdrawn'
export type AdmissionStatus = 'pending' | 'approved' | 'revoked'
export type RoundParticipantStatus = 'active' | 'advanced' | 'eliminated'
export type IntegrityEventKind = 'hidden' | 'blur' | 'return' | 'beforeunload' | 'auto_submit'

export type ParticipantRow = {
  id: string
  event_id: string
  name: string
  type: ParticipantType
  members: string | null
  status: ParticipantStatus
  user_id: string | null
  admission_status: AdmissionStatus
  created_at: string
}

export type RoundParticipantRow = {
  id: string
  round_id: string
  participant_id: string
  status: RoundParticipantStatus
  advanced_by_calculation_id: string | null
  created_at: string
  updated_at: string
  participant: ParticipantRow
}

export type AnswerRow = {
  id: string
  participant_id: string
  question_id: string
  round_id: string
  segment_id: string
  submitted_text: string | null
  submitted_at: string | null
  is_saved_draft: boolean
  client_elapsed_ms: number | null
  auto_correct: boolean | null
  final_correct: boolean | null
  graded_by: string | null
  graded_at: string | null
  created_at: string
  updated_at: string
}

export type IntegrityEventRow = {
  id: string
  participant_id: string
  question_id: string | null
  kind: IntegrityEventKind
  occurred_at: string
  duration_ms: number | null
  created_at: string
}
