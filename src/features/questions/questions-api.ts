import { getErrorMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { BooleanAnswerValue } from './answer-type'
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

export async function updateAcceptableAnswer(
  answerId: string,
  value: string,
  isNumeric: boolean,
): Promise<AcceptableAnswerRow> {
  const { data, error } = await supabase
    .from('question_acceptable_answers')
    .update({ value, is_numeric: isNumeric })
    .eq('id', answerId)
    .select()
    .single()

  if (error) throw error
  return data as AcceptableAnswerRow
}

// A True/False question has exactly one correct answer, so picking one
// replaces whatever the question had before (including free-text answers
// left behind by a question that used to be text or numeric). Not a
// transaction: this is draft-only authoring, and a failed insert after a
// successful delete leaves the question answer-less, which the UI already
// renders as "no correct answer chosen yet".
export async function setBooleanAcceptableAnswer(
  questionId: string,
  value: BooleanAnswerValue,
): Promise<AcceptableAnswerRow> {
  const { error: deleteError } = await supabase
    .from('question_acceptable_answers')
    .delete()
    .eq('question_id', questionId)

  if (deleteError) throw deleteError

  return addAcceptableAnswer(questionId, value, false)
}
