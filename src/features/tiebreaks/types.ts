export type TiebreakScope = 'advance' | 'winner'
export type TiebreakStatus = 'open' | 'resolved' | 'exhausted'
export type TiebreakEntrantOutcome = 'pending' | 'advanced' | 'eliminated'

export type TiebreakRow = {
  id: string
  round_id: string
  scope: TiebreakScope
  cutoff_rank: number
  calculation_id: string
  slots_to_fill: number
  status: TiebreakStatus
  resolved_at: string | null
  created_by: string
  created_at: string
}

export type TiebreakEntrantRow = {
  tiebreak_id: string
  participant_id: string
  outcome: TiebreakEntrantOutcome
}

export type TiebreakQuestionRow = {
  id: string
  tiebreak_id: string
  question_id: string
  sequence: number
  drawn_at: string
  resolved_at: string | null
  broke_tie: boolean | null
}
