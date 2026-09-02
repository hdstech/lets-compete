export type AnswerType = 'text' | 'numeric'
export type QuestionStatus = 'pending' | 'revealed' | 'window_open' | 'window_closed' | 'voided'

export type QuestionRow = {
  id: string
  segment_id: string
  prompt: string
  answer_type: AnswerType
  window_seconds: number
  sequence: number
  is_tiebreak: boolean
  status: QuestionStatus
  reveal_token: string | null
  revealed_at: string | null
  window_closed_at: string | null
  voided_at: string | null
  voided_by: string | null
  created_at: string
}

export type AcceptableAnswerRow = {
  id: string
  question_id: string
  value: string
  is_numeric: boolean
  created_at: string
}
