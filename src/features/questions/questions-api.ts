import { getErrorMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { AcceptableAnswerRow, AnswerType, QuestionRow } from './types'

export { getErrorMessage }

export async function listQuestions(segmentId: string): Promise<QuestionRow[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('segment_id', segmentId)
    .order('sequence', { ascending: true })

  if (error) throw error
  return data as QuestionRow[]
}

export async function getQuestion(questionId: string): Promise<QuestionRow> {
  const { data, error } = await supabase.from('questions').select('*').eq('id', questionId).single()

  if (error) throw error
  return data as QuestionRow
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
