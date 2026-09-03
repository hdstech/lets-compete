import { useEffect, useState } from 'react'
import type { SubmitEvent } from 'react'
import { useParams } from 'react-router-dom'
import { AuthForm, ErrorText, Field, Input, Label } from '../auth/auth-ui'
import { Button, Button as SubmitButton } from '../../components/ui/Button'
import {
  Title as PageTitle,
  Subtitle as PageSubtitle,
} from '../../components/ui/Typography'
import { getEvent } from '../events/events-api'
import {
  BackLink,
  Card,
  CheckboxField,
  DefinitionGrid,
  DefinitionTerm,
  DefinitionValue,
  EmptyState,
  HelpText,
  PageHeader,
  PageInner,
  PageShell,
  Row,
  SectionTitle,
} from '../events/events-ui'
import type { EventRow } from '../events/types'
import { getSegment } from '../segments/segments-api'
import type { SegmentRow } from '../segments/types'
import {
  addAcceptableAnswer,
  createQuestion,
  deleteAcceptableAnswer,
  deleteQuestion,
  getErrorMessage,
  listAcceptableAnswers,
  listQuestions,
  updateQuestion,
} from './questions-api'
import type { QuestionInput } from './questions-api'
import type { AcceptableAnswerRow, AnswerType, QuestionRow } from './types'

function nextSequence(questions: QuestionRow[]): number {
  if (questions.length === 0) return 1
  return Math.max(...questions.map((question) => question.sequence)) + 1
}

type QuestionFormValues = {
  prompt: string
  answerType: AnswerType
  windowSeconds: string
  sequence: string
  isTiebreak: boolean
}

function emptyForm(sequence: number): QuestionFormValues {
  return {
    prompt: '',
    answerType: 'text',
    windowSeconds: '30',
    sequence: String(sequence),
    isTiebreak: false,
  }
}

function validate(
  values: QuestionFormValues,
  questions: QuestionRow[],
  excludeId: string | null,
): { input: QuestionInput } | { error: string } {
  if (!values.prompt.trim()) {
    return { error: 'Enter a question prompt.' }
  }

  const sequence = Number(values.sequence)
  if (!Number.isInteger(sequence) || sequence < 1) {
    return { error: 'Sequence must be a positive whole number.' }
  }

  const sequenceConflict = questions.find(
    (q) => q.sequence === sequence && q.id !== excludeId,
  )
  if (sequenceConflict) {
    return {
      error: `Sequence ${sequence} is already used by another question in this segment.`,
    }
  }

  const windowSeconds = Number(values.windowSeconds)
  if (!Number.isInteger(windowSeconds) || windowSeconds < 1) {
    return {
      error: 'Answer window must be a positive whole number of seconds.',
    }
  }

  return {
    input: {
      prompt: values.prompt,
      answerType: values.answerType,
      windowSeconds,
      sequence,
      isTiebreak: values.isTiebreak,
    },
  }
}

type AnswerFormValues = { value: string; isNumeric: boolean }

function emptyAnswerForm(question: QuestionRow): AnswerFormValues {
  return { value: '', isNumeric: question.answer_type === 'numeric' }
}

export function QuestionsPage() {
  const { eventId, roundId, segmentId } = useParams<{
    eventId: string
    roundId: string
    segmentId: string
  }>()

  const [event, setEvent] = useState<EventRow | null>(null)
  const [segment, setSegment] = useState<SegmentRow | null>(null)
  const [questions, setQuestions] = useState<QuestionRow[] | null>(null)
  const [answersByQuestion, setAnswersByQuestion] = useState<
    Record<string, AcceptableAnswerRow[]>
  >({})
  const [loadError, setLoadError] = useState<string | null>(null)

  const [newQuestion, setNewQuestion] = useState<QuestionFormValues>(
    emptyForm(1),
  )
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQuestion, setEditQuestion] = useState<QuestionFormValues>(
    emptyForm(1),
  )
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [newAnswer, setNewAnswer] = useState<Record<string, AnswerFormValues>>(
    {},
  )
  const [answerError, setAnswerError] = useState<Record<string, string | null>>(
    {},
  )
  const [addingAnswerFor, setAddingAnswerFor] = useState<string | null>(null)
  const [deletingAnswerId, setDeletingAnswerId] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId || !segmentId) return

    let cancelled = false
    Promise.all([
      getEvent(eventId),
      getSegment(segmentId),
      listQuestions(segmentId),
    ])
      .then(async ([eventRow, segmentRow, questionRows]) => {
        if (cancelled) return
        const answersMap = await loadAnswersMap(questionRows)
        if (cancelled) return
        setEvent(eventRow)
        setSegment(segmentRow)
        setQuestions(questionRows)
        setAnswersByQuestion(answersMap)
        setNewQuestion(emptyForm(nextSequence(questionRows)))
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [eventId, segmentId])

  async function loadAnswersMap(
    rows: QuestionRow[],
  ): Promise<Record<string, AcceptableAnswerRow[]>> {
    const answerLists = await Promise.all(
      rows.map((q) => listAcceptableAnswers(q.id)),
    )
    const map: Record<string, AcceptableAnswerRow[]> = {}
    rows.forEach((q, i) => {
      map[q.id] = answerLists[i]
    })
    return map
  }

  async function refreshQuestions() {
    if (!segmentId) return
    const rows = await listQuestions(segmentId)
    const answersMap = await loadAnswersMap(rows)
    setQuestions(rows)
    setAnswersByQuestion(answersMap)
    setNewQuestion(emptyForm(nextSequence(rows)))
  }

  async function refreshAnswers(questionId: string) {
    const rows = await listAcceptableAnswers(questionId)
    setAnswersByQuestion((prev) => ({ ...prev, [questionId]: rows }))
  }

  async function handleAddQuestion(formEvent: SubmitEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (!segmentId || !questions) return

    setAddError(null)
    const result = validate(newQuestion, questions, null)
    if ('error' in result) {
      setAddError(result.error)
      return
    }

    setAdding(true)
    try {
      await createQuestion(segmentId, result.input)
      await refreshQuestions()
    } catch (err) {
      setAddError(getErrorMessage(err, 'Failed to create question'))
    } finally {
      setAdding(false)
    }
  }

  function startEdit(question: QuestionRow) {
    setEditingId(question.id)
    setEditQuestion({
      prompt: question.prompt,
      answerType: question.answer_type,
      windowSeconds: String(question.window_seconds),
      sequence: String(question.sequence),
      isTiebreak: question.is_tiebreak,
    })
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

  async function handleSaveEdit(formEvent: SubmitEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (!editingId || !questions) return

    setEditError(null)
    const result = validate(editQuestion, questions, editingId)
    if ('error' in result) {
      setEditError(result.error)
      return
    }

    setSaving(true)
    try {
      await updateQuestion(editingId, result.input)
      setEditingId(null)
      await refreshQuestions()
    } catch (err) {
      setEditError(getErrorMessage(err, 'Failed to save question'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(question: QuestionRow) {
    if (!window.confirm('Delete this question? This cannot be undone.')) return

    setDeleteError(null)
    setDeletingId(question.id)
    try {
      await deleteQuestion(question.id)
      await refreshQuestions()
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Failed to delete question'))
    } finally {
      setDeletingId(null)
    }
  }

  function answerFormFor(question: QuestionRow): AnswerFormValues {
    return newAnswer[question.id] ?? emptyAnswerForm(question)
  }

  async function handleAddAnswer(
    formEvent: SubmitEvent<HTMLFormElement>,
    question: QuestionRow,
  ) {
    formEvent.preventDefault()
    const form = answerFormFor(question)
    if (!form.value.trim()) {
      setAnswerError((prev) => ({
        ...prev,
        [question.id]: 'Enter an acceptable answer value.',
      }))
      return
    }

    setAnswerError((prev) => ({ ...prev, [question.id]: null }))
    setAddingAnswerFor(question.id)
    try {
      await addAcceptableAnswer(question.id, form.value, form.isNumeric)
      await refreshAnswers(question.id)
      setNewAnswer((prev) => ({
        ...prev,
        [question.id]: emptyAnswerForm(question),
      }))
    } catch (err) {
      setAnswerError((prev) => ({
        ...prev,
        [question.id]: getErrorMessage(err, 'Failed to add acceptable answer'),
      }))
    } finally {
      setAddingAnswerFor(null)
    }
  }

  async function handleDeleteAnswer(answer: AcceptableAnswerRow) {
    setDeletingAnswerId(answer.id)
    try {
      await deleteAcceptableAnswer(answer.id)
      await refreshAnswers(answer.question_id)
    } catch (err) {
      setAnswerError((prev) => ({
        ...prev,
        [answer.question_id]: getErrorMessage(
          err,
          'Failed to remove acceptable answer',
        ),
      }))
    } finally {
      setDeletingAnswerId(null)
    }
  }

  if (loadError) {
    return (
      <PageShell>
        <PageInner>
          <BackLink to={`/events/${eventId}/rounds/${roundId}/segments`}>
            Back to segments
          </BackLink>
          <ErrorText role="alert">{loadError}</ErrorText>
        </PageInner>
      </PageShell>
    )
  }

  if (!event || !segment || !questions) {
    return (
      <PageShell>
        <PageInner>
          <PageSubtitle>Loading…</PageSubtitle>
        </PageInner>
      </PageShell>
    )
  }

  const isDraft = event.status === 'draft'

  return (
    <PageShell>
      <PageInner>
        <PageHeader>
          <div>
            <PageTitle>Questions — {segment.name}</PageTitle>
            <PageSubtitle>
              Author this segment's questions, their acceptable answers, and the
              timed answer window. A tiebreak reserve question is held back for
              sudden-death instead of the normal running order.
            </PageSubtitle>
          </div>
          <BackLink to={`/events/${event.id}/rounds/${roundId}/segments`}>
            Back to segments
          </BackLink>
        </PageHeader>

        {!isDraft && (
          <HelpText>
            Question authoring is frozen because this event is no longer in
            draft — activating an event locks prompts, answer type, window
            length, sequence, and the tiebreak flag.
          </HelpText>
        )}

        {questions.length === 0 && <EmptyState>No questions yet.</EmptyState>}

        {questions.map((question) => {
          const answers = answersByQuestion[question.id] ?? []
          const answerForm = answerFormFor(question)

          if (editingId === question.id) {
            return (
              <Card key={question.id}>
                <SectionTitle>Edit question</SectionTitle>
                <AuthForm onSubmit={handleSaveEdit}>
                  <Field>
                    <Label htmlFor="question_prompt">Prompt</Label>
                    <Input
                      id="question_prompt"
                      type="text"
                      required
                      value={editQuestion.prompt}
                      onChange={(e) =>
                        setEditQuestion({
                          ...editQuestion,
                          prompt: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <Label>Answer type</Label>
                    <Row>
                      <CheckboxField>
                        <input
                          type="radio"
                          name="question_answer_type"
                          checked={editQuestion.answerType === 'text'}
                          onChange={() =>
                            setEditQuestion({
                              ...editQuestion,
                              answerType: 'text',
                            })
                          }
                        />
                        Text
                      </CheckboxField>
                      <CheckboxField>
                        <input
                          type="radio"
                          name="question_answer_type"
                          checked={editQuestion.answerType === 'numeric'}
                          onChange={() =>
                            setEditQuestion({
                              ...editQuestion,
                              answerType: 'numeric',
                            })
                          }
                        />
                        Numeric
                      </CheckboxField>
                    </Row>
                  </Field>
                  <Field>
                    <Label htmlFor="question_window_seconds">
                      Answer window (seconds)
                    </Label>
                    <Input
                      id="question_window_seconds"
                      type="number"
                      min={1}
                      required
                      value={editQuestion.windowSeconds}
                      onChange={(e) =>
                        setEditQuestion({
                          ...editQuestion,
                          windowSeconds: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="question_sequence">Sequence</Label>
                    <Input
                      id="question_sequence"
                      type="number"
                      min={1}
                      required
                      value={editQuestion.sequence}
                      onChange={(e) =>
                        setEditQuestion({
                          ...editQuestion,
                          sequence: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <CheckboxField>
                      <input
                        type="checkbox"
                        checked={editQuestion.isTiebreak}
                        onChange={(e) =>
                          setEditQuestion({
                            ...editQuestion,
                            isTiebreak: e.target.checked,
                          })
                        }
                      />
                      Tiebreak reserve pool question
                    </CheckboxField>
                  </Field>
                  {editError && <ErrorText role="alert">{editError}</ErrorText>}
                  <Row>
                    <SubmitButton type="submit" disabled={saving}>
                      {saving ? 'Saving…' : 'Save question'}
                    </SubmitButton>
                    <Button type="button" tone="secondary" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </Row>
                </AuthForm>
              </Card>
            )
          }

          return (
            <Card key={question.id}>
              <SectionTitle>
                Question {question.sequence}
                {question.is_tiebreak ? ' (tiebreak reserve)' : ''}
              </SectionTitle>
              <DefinitionGrid>
                <DefinitionTerm>Prompt</DefinitionTerm>
                <DefinitionValue>{question.prompt}</DefinitionValue>
                <DefinitionTerm>Answer type</DefinitionTerm>
                <DefinitionValue>{question.answer_type}</DefinitionValue>
                <DefinitionTerm>Answer window</DefinitionTerm>
                <DefinitionValue>{question.window_seconds}s</DefinitionValue>
                <DefinitionTerm>Status</DefinitionTerm>
                <DefinitionValue>
                  {question.status.replace('_', ' ')}
                </DefinitionValue>
              </DefinitionGrid>

              <SectionTitle>Acceptable answers</SectionTitle>
              {answers.length === 0 && (
                <HelpText>No acceptable answers yet.</HelpText>
              )}
              {answers.map((answer) => (
                <Row key={answer.id}>
                  <HelpText>
                    {answer.value}
                    {answer.is_numeric ? ' (numeric)' : ''}
                  </HelpText>
                  {isDraft && (
                    <Button
                      type="button"
                      tone="danger"
                      onClick={() => handleDeleteAnswer(answer)}
                      disabled={deletingAnswerId === answer.id}
                    >
                      {deletingAnswerId === answer.id ? 'Removing…' : 'Remove'}
                    </Button>
                  )}
                </Row>
              ))}

              {isDraft && (
                <AuthForm onSubmit={(e) => handleAddAnswer(e, question)}>
                  <Row>
                    <Input
                      type="text"
                      placeholder="Acceptable answer value"
                      aria-label={`Acceptable answer for question ${question.sequence}`}
                      value={answerForm.value}
                      onChange={(e) =>
                        setNewAnswer((prev) => ({
                          ...prev,
                          [question.id]: {
                            ...answerForm,
                            value: e.target.value,
                          },
                        }))
                      }
                    />
                    <CheckboxField>
                      <input
                        type="checkbox"
                        checked={answerForm.isNumeric}
                        onChange={(e) =>
                          setNewAnswer((prev) => ({
                            ...prev,
                            [question.id]: {
                              ...answerForm,
                              isNumeric: e.target.checked,
                            },
                          }))
                        }
                      />
                      Numeric
                    </CheckboxField>
                    <SubmitButton
                      type="submit"
                      disabled={addingAnswerFor === question.id}
                    >
                      {addingAnswerFor === question.id
                        ? 'Adding…'
                        : 'Add answer'}
                    </SubmitButton>
                  </Row>
                  {answerError[question.id] && (
                    <ErrorText role="alert">
                      {answerError[question.id]}
                    </ErrorText>
                  )}
                </AuthForm>
              )}

              {isDraft && (
                <Row>
                  <Button
                    type="button"
                    tone="secondary"
                    onClick={() => startEdit(question)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    tone="danger"
                    onClick={() => handleDelete(question)}
                    disabled={deletingId === question.id}
                  >
                    {deletingId === question.id ? 'Deleting…' : 'Delete'}
                  </Button>
                </Row>
              )}
            </Card>
          )
        })}

        {deleteError && <ErrorText role="alert">{deleteError}</ErrorText>}

        {isDraft && !editingId && (
          <Card>
            <SectionTitle>Add question</SectionTitle>
            <AuthForm onSubmit={handleAddQuestion}>
              <Field>
                <Label htmlFor="new_question_prompt">Prompt</Label>
                <Input
                  id="new_question_prompt"
                  type="text"
                  required
                  value={newQuestion.prompt}
                  onChange={(e) =>
                    setNewQuestion({ ...newQuestion, prompt: e.target.value })
                  }
                />
              </Field>
              <Field>
                <Label>Answer type</Label>
                <Row>
                  <CheckboxField>
                    <input
                      type="radio"
                      name="new_question_answer_type"
                      checked={newQuestion.answerType === 'text'}
                      onChange={() =>
                        setNewQuestion({ ...newQuestion, answerType: 'text' })
                      }
                    />
                    Text
                  </CheckboxField>
                  <CheckboxField>
                    <input
                      type="radio"
                      name="new_question_answer_type"
                      checked={newQuestion.answerType === 'numeric'}
                      onChange={() =>
                        setNewQuestion({
                          ...newQuestion,
                          answerType: 'numeric',
                        })
                      }
                    />
                    Numeric
                  </CheckboxField>
                </Row>
              </Field>
              <Field>
                <Label htmlFor="new_question_window_seconds">
                  Answer window (seconds)
                </Label>
                <Input
                  id="new_question_window_seconds"
                  type="number"
                  min={1}
                  required
                  value={newQuestion.windowSeconds}
                  onChange={(e) =>
                    setNewQuestion({
                      ...newQuestion,
                      windowSeconds: e.target.value,
                    })
                  }
                />
              </Field>
              <Field>
                <Label htmlFor="new_question_sequence">Sequence</Label>
                <Input
                  id="new_question_sequence"
                  type="number"
                  min={1}
                  required
                  value={newQuestion.sequence}
                  onChange={(e) =>
                    setNewQuestion({ ...newQuestion, sequence: e.target.value })
                  }
                />
              </Field>
              <Field>
                <CheckboxField>
                  <input
                    type="checkbox"
                    checked={newQuestion.isTiebreak}
                    onChange={(e) =>
                      setNewQuestion({
                        ...newQuestion,
                        isTiebreak: e.target.checked,
                      })
                    }
                  />
                  Tiebreak reserve pool question
                </CheckboxField>
              </Field>
              {addError && <ErrorText role="alert">{addError}</ErrorText>}
              <SubmitButton type="submit" disabled={adding}>
                {adding ? 'Adding…' : 'Add question'}
              </SubmitButton>
            </AuthForm>
          </Card>
        )}
      </PageInner>
    </PageShell>
  )
}
