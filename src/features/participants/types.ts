export type ParticipantType = 'individual' | 'team'
export type ParticipantEligibilityStatus = 'eligible' | 'disqualified' | 'withdrawn'
export type AdmissionStatus = 'pending' | 'approved' | 'revoked'

export type ParticipantRow = {
  id: string
  event_id: string
  name: string
  type: ParticipantType
  members: string | null
  status: ParticipantEligibilityStatus
  user_id: string | null
  admission_status: AdmissionStatus
  created_at: string
}
