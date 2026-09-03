export type ResultCalculationRow = {
  id: string
  event_id: string
  round_id: string | null
  segment_id: string | null
  calculated_at: string
  calculated_by: string
  reason: string | null
  is_final: boolean
}

export type ResultCalculationEntryRow = {
  id: string
  calculation_id: string
  participant_id: string
  total_score: number
  rank: number
}
