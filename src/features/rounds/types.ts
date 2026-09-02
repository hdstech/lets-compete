export type RoundStatus = 'pending' | 'scoring_open' | 'scoring_closed' | 'advanced'

export type RoundRow = {
  id: string
  event_id: string
  name: string
  sequence: number
  advancement_n: number | null
  is_final_round: boolean
  status: RoundStatus
  scoring_opened_at: string | null
  scoring_closed_at: string | null
  advanced_at: string | null
  created_at: string
}
