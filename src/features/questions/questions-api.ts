import { supabase } from '../../lib/supabase'
import type { AcceptableAnswerRow, AnswerType, QuestionRow } from './types'

// Supabase/PostgREST errors (PostgrestError) are plain objects, not Error
// instances, so callers can't rely on `err instanceof Error` to read a
// meaningful message (e.g. a raised trigger exception) out of a catch block.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}

export async function listQuestions(segmentId: string): Promise<QuestionRow[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('segment_id', segmentId)
    .order('sequence', { ascending: true })

  if (error) throw error
  return data as QuestionRow[]
}

export type QuestionInput = {
  prompt: string
  answerType: AnswerType
  windowSeconds: number
  sequence: number
  isTiebreak: boolean
}

export async function createQuestion(segmentId: string, input: QuestionInput): Promise<QuestionRow> {
  const { data, error } = await supabase
    .from('questions')
    .insert({
      segment_id: segmentId,
      prompt: input.prompt,
      answer_type: input.answerType,
      window_seconds: input.windowSeconds,
      sequence: input.sequence,
      is_tiebreak: input.isTiebreak,
    })
    .select()
    .single()

  if (error) throw error
  return data as QuestionRow
}

export async function updateQuestion(questionId: string, input: QuestionInput): Promise<QuestionRow> {
  const { data, error } = await supabase
    .from('questions')
    .update({
      prompt: input.prompt,
      answer_type: input.answerType,
      window_seconds: input.windowSeconds,
      sequence: input.sequence,
      is_tiebreak: input.isTiebreak,
    })
    .eq('id', questionId)
    .select()
    .single()

  if (error) throw error
  return data as QuestionRow
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const { error } = await supabase.from('questions').delete().eq('id', questionId)
  if (error) throw error
}

export async function listAcceptableAnswers(questionId: string): Promise<AcceptableAnswerRow[]> {
  const { data, error } = await supabase
    .from('question_acceptable_answers')
    .select('*')
    .eq('question_id', questionId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as AcceptableAnswerRow[]
}

export async function addAcceptableAnswer(
  questionId: string,
  value: string,
  isNumeric: boolean,
): Promise<AcceptableAnswerRow> {
  const { data, error } = await supabase
    .from('question_acceptable_answers')
    .insert({ question_id: questionId, value, is_numeric: isNumeric })
    .select()
    .single()

  if (error) throw error
  return data as AcceptableAnswerRow
}

export async function deleteAcceptableAnswer(answerId: string): Promise<void> {
  const { error } = await supabase.from('question_acceptable_answers').delete().eq('id', answerId)
  if (error) throw error
}
