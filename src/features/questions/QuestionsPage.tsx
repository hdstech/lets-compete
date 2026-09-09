import { Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { SubmitEvent } from 'react'
import { useParams } from 'react-router-dom'
import { AuthForm, ErrorText, Field, Input, Label } from '../auth/auth-ui'
import { Button, Button as SubmitButton } from '../../components/ui/Button'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingBlock } from '../../components/ui/LoadingBlock'
import {
  Title as PageTitle,
  Subtitle as PageSubtitle,
} from '../../components/ui/Typography'
import { usePageBreadcrumbs, useUnsavedChanges } from '../admin-shell/use-breadcrumbs'
import { getEvent } from '../events/events-api'
import {
  BackLink,
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
import { Card } from '../../components/ui/Card'
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
import {
  filterNumericAnswerInput,
  validateAcceptableAnswer,
} from './acceptable-answer'
import {
  AcceptableAnswerField,
  AcceptableAnswerInput,
  AcceptableAnswerItem,
  AcceptableAnswerList,
  AcceptableAnswerMeta,
  AcceptableAnswerText,
  InlineCheckboxField,
  RemoveAnswerButton,
} from './questions-ui'
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
  const { eventId, segmentId } = useParams<{
    eventId: string
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
  // Acceptable answers staged on the create form, saved together with the
  // question in one action. `newAnswerDraft` is the value currently typed but
  // not yet added to the list; it's also included on submit so a single
  // answer needn't be explicitly "added" first.
  const [newQuestionAnswers, setNewQuestionAnswers] = useState<string[]>([])
  const [newAnswerDraft, setNewAnswerDraft] = useState('')
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

  usePageBreadcrumbs(
    event && segment
      ? [
          { label: event.name, to: `/events/${event.id}` },
          { label: 'Rounds', to: `/events/${event.id}/rounds` },
          { label: segment.name },
        ]
      : [{ label: 'Questions' }],
  )

  // A half-authored question (prompt typed, answers staged) or an in-progress
  // edit is unsaved work worth warning about before breadcrumb navigation.
  useUnsavedChanges(
    editingId !== null ||
      newQuestion.prompt.trim() !== '' ||
      newQuestionAnswers.length > 0 ||
      newAnswerDraft.trim() !== '',
  )

  const loadData = useCallback(() => {
    if (!eventId || !segmentId) return () => {}

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
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Failed to load questions'))
      })

    return () => {
      cancelled = true
    }
  }, [eventId, segmentId])

  useEffect(() => loadData(), [loadData])

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

  function stageNewAnswer() {
    const value = newAnswerDraft.trim()
    if (!value) return
    setNewQuestionAnswers((prev) => [...prev, value])
    setNewAnswerDraft('')
  }

  function unstageNewAnswer(index: number) {
    setNewQuestionAnswers((prev) => prev.filter((_, i) => i !== index))
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

    // Save the question together with its acceptable answers: the staged
    // list plus any value typed but not yet added. Acceptable answers inherit
    // the question's answer type here; per-answer numeric overrides remain
    // available afterward through the per-question editor below.
    const answers = [...newQuestionAnswers]
    const draft = newAnswerDraft.trim()
    if (draft) answers.push(draft)
    const isNumeric = newQuestion.answerType === 'numeric'

    setAdding(true)
    let created: QuestionRow
    try {
      created = await createQuestion(segmentId, result.input)
    } catch (err) {
      setAddError(getErrorMessage(err, 'Failed to create question'))
      setAdding(false)
      return
    }

    try {
      for (const value of answers) {
        await addAcceptableAnswer(created.id, value, isNumeric)
      }
    } catch (err) {
      setAddError(
        getErrorMessage(
          err,
          'Question saved, but an acceptable answer failed to save',
        ),
      )
    }

    setNewQuestionAnswers([])
    setNewAnswerDraft('')
    await refreshQuestions()
    setAdding(false)
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
    const validationError = validateAcceptableAnswer(form.value, form.isNumeric)
    if (validationError) {
      setAnswerError((prev) => ({
        ...prev,
        [question.id]: validationError,
      }))
      return
    }

    const value = form.value.trim()
    setAnswerError((prev) => ({ ...prev, [question.id]: null }))
    setAddingAnswerFor(question.id)
    try {
      await addAcceptableAnswer(question.id, value, form.isNumeric)
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
          <BackLink to={`/events/${eventId}/rounds`}>Back to rounds</BackLink>
          <ErrorState
            message={loadError}
            onRetry={() => {
              setLoadError(null)
              loadData()
            }}
          />
        </PageInner>
      </PageShell>
    )
  }

  if (!event || !segment || !questions) {
    return (
      <PageShell>
        <PageInner>
          <LoadingBlock label="Loading questions…" />
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
          <BackLink to={`/events/${event.id}/rounds`}>Back to rounds</BackLink>
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
                  <Row equal>
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
              {answers.length > 0 && (
                <AcceptableAnswerList>
                  {answers.map((answer) => (
                    <AcceptableAnswerItem key={answer.id}>
                      <AcceptableAnswerText>
                        {answer.value}
                        {answer.is_numeric && (
                          <AcceptableAnswerMeta> (numeric)</AcceptableAnswerMeta>
                        )}
                      </AcceptableAnswerText>
                      {isDraft && (
                        <RemoveAnswerButton
                          type="button"
                          onClick={() => handleDeleteAnswer(answer)}
                          disabled={deletingAnswerId === answer.id}
                          aria-label={
                            deletingAnswerId === answer.id
                              ? 'Removing answer'
                              : 'Remove answer'
                          }
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </RemoveAnswerButton>
                      )}
                    </AcceptableAnswerItem>
                  ))}
                </AcceptableAnswerList>
              )}

              {isDraft && (
                <AuthForm onSubmit={(e) => handleAddAnswer(e, question)}>
                  <Row>
                    <AcceptableAnswerField>
                      <AcceptableAnswerInput
                        type="text"
                        placeholder="Acceptable answer value"
                        aria-label={`Acceptable answer for question ${question.sequence}`}
                        inputMode={answerForm.isNumeric ? 'decimal' : 'text'}
                        value={answerForm.value}
                        onChange={(e) => {
                          const raw = e.target.value
                          const value = answerForm.isNumeric
                            ? filterNumericAnswerInput(raw)
                            : raw
                          setNewAnswer((prev) => ({
                            ...prev,
                            [question.id]: {
                              ...answerForm,
                              value,
                            },
                          }))
                          if (answerError[question.id]) {
                            setAnswerError((prev) => ({
                              ...prev,
                              [question.id]: null,
                            }))
                          }
                        }}
                      />
                      <InlineCheckboxField>
                        <input
                          id={`answer_numeric_${question.id}`}
                          type="checkbox"
                          checked={answerForm.isNumeric}
                          onChange={(e) => {
                            const isNumeric = e.target.checked
                            setNewAnswer((prev) => ({
                              ...prev,
                              [question.id]: {
                                ...answerForm,
                                isNumeric,
                                value: isNumeric
                                  ? filterNumericAnswerInput(answerForm.value)
                                  : answerForm.value,
                              },
                            }))
                            setAnswerError((prev) => ({
                              ...prev,
                              [question.id]: null,
                            }))
                          }}
                        />
                        Numeric
                      </InlineCheckboxField>
                    </AcceptableAnswerField>
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
                <Row equal>
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
              <Field>
                <Label htmlFor="new_question_answer">Acceptable answers</Label>
                {newQuestionAnswers.length === 0 && (
                  <HelpText>
                    Add one or more acceptable answers — they save with the
                    question.
                  </HelpText>
                )}
                {newQuestionAnswers.length > 0 && (
                  <AcceptableAnswerList>
                    {newQuestionAnswers.map((value, index) => (
                      <AcceptableAnswerItem key={`${value}-${index}`}>
                        <AcceptableAnswerText>{value}</AcceptableAnswerText>
                        <RemoveAnswerButton
                          type="button"
                          onClick={() => unstageNewAnswer(index)}
                          aria-label="Remove answer"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </RemoveAnswerButton>
                      </AcceptableAnswerItem>
                    ))}
                  </AcceptableAnswerList>
                )}
                <Row>
                  <Input
                    id="new_question_answer"
                    type="text"
                    placeholder="New acceptable answer"
                    aria-label="Acceptable answer for the new question"
                    value={newAnswerDraft}
                    onChange={(e) => setNewAnswerDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        stageNewAnswer()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    tone="secondary"
                    onClick={stageNewAnswer}
                  >
                    Add acceptable answer
                  </Button>
                </Row>
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
