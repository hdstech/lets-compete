import { Check, Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { AuthForm, ErrorText } from '../auth/auth-ui'
import { Button } from '../../components/ui/Button'
import { CheckboxField, HelpText, Row } from '../events/events-ui'
import {
  filterNumericAnswerInput,
  validateAcceptableAnswer,
} from './acceptable-answer'
import { BOOLEAN_ANSWER_VALUES, parseBooleanAnswer } from './answer-type'
import type { BooleanAnswerValue } from './answer-type'
import {
  addAcceptableAnswer,
  deleteAcceptableAnswer,
  getErrorMessage,
  setBooleanAcceptableAnswer,
  updateAcceptableAnswer,
} from './questions-api'
import {
  AcceptableAnswerField,
  AcceptableAnswerInput,
  AcceptableAnswerItem,
  AcceptableAnswerList,
  AcceptableAnswerMeta,
  AcceptableAnswerText,
  AnswerEditForm,
  AnswerIconButton,
  AnswerItemActions,
  InlineCheckboxField,
} from './questions-ui'
import type { AcceptableAnswerRow, QuestionRow } from './types'

type Props = {
  question: QuestionRow
  answers: AcceptableAnswerRow[]
  // False once the event leaves draft, when acceptable answers are frozen
  // along with the rest of question authoring (QA4's draft-only guard).
  editable: boolean
  // Reloads this question's answers after a write.
  onChanged: () => Promise<void>
}

type AnswerDraft = { value: string; isNumeric: boolean }

// Editor for one question's acceptable answers. A True/False question gets a
// single correct-answer picker; text and numeric questions get the list of
// accepted values, each of which can be edited in place or removed.
export function AcceptableAnswersEditor({
  question,
  answers,
  editable,
  onChanged,
}: Props) {
  const [draft, setDraft] = useState<AnswerDraft>({
    value: '',
    isNumeric: question.answer_type === 'numeric',
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<AnswerDraft>({
    value: '',
    isNumeric: false,
  })
  const [error, setError] = useState<string | null>(null)
  // Which write is in flight, if any — one at a time, so the whole editor
  // disables while it runs and only the button that started it re-labels.
  const [pending, setPending] = useState<'add' | 'edit' | 'delete' | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const saving = pending !== null

  async function runWrite(
    kind: 'add' | 'edit' | 'delete',
    write: () => Promise<unknown>,
    fallbackMessage: string,
  ): Promise<boolean> {
    setError(null)
    setPending(kind)
    try {
      await write()
      await onChanged()
      return true
    } catch (err) {
      setError(getErrorMessage(err, fallbackMessage))
      return false
    } finally {
      setPending(null)
    }
  }

  async function handleAdd(formEvent: SubmitEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    const validationError = validateAcceptableAnswer(draft.value, draft.isNumeric)
    if (validationError) {
      setError(validationError)
      return
    }

    const added = await runWrite(
      'add',
      () => addAcceptableAnswer(question.id, draft.value.trim(), draft.isNumeric),
      'Failed to add acceptable answer',
    )
    if (added) {
      setDraft({ value: '', isNumeric: question.answer_type === 'numeric' })
    }
  }

  function startEdit(answer: AcceptableAnswerRow) {
    setEditingId(answer.id)
    setEditDraft({ value: answer.value, isNumeric: answer.is_numeric })
    setError(null)
  }

  async function handleSaveEdit(formEvent: SubmitEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (!editingId) return

    const validationError = validateAcceptableAnswer(
      editDraft.value,
      editDraft.isNumeric,
    )
    if (validationError) {
      setError(validationError)
      return
    }

    const saved = await runWrite(
      'edit',
      () =>
        updateAcceptableAnswer(
          editingId,
          editDraft.value.trim(),
          editDraft.isNumeric,
        ),
      'Failed to update acceptable answer',
    )
    if (saved) setEditingId(null)
  }

  async function handleDelete(answer: AcceptableAnswerRow) {
    setDeletingId(answer.id)
    try {
      await runWrite(
        'delete',
        () => deleteAcceptableAnswer(answer.id),
        'Failed to remove acceptable answer',
      )
      if (editingId === answer.id) setEditingId(null)
    } finally {
      setDeletingId(null)
    }
  }

  async function handlePickCorrect(value: BooleanAnswerValue) {
    await runWrite(
      'edit',
      () => setBooleanAcceptableAnswer(question.id, value),
      'Failed to set the correct answer',
    )
  }

  if (question.answer_type === 'boolean') {
    // A True/False question keeps exactly one acceptable answer; anything
    // else on the row (e.g. free text left over from a question that used to
    // be text) reads as "not chosen yet" and is replaced on the next pick.
    const correct =
      answers.map((answer) => parseBooleanAnswer(answer.value)).find(Boolean) ??
      null

    if (!editable) {
      return (
        <HelpText>
          {correct
            ? `Correct answer: ${correct}.`
            : 'No correct answer was chosen for this question.'}
        </HelpText>
      )
    }

    return (
      <>
        <Row>
          {BOOLEAN_ANSWER_VALUES.map((value) => (
            <CheckboxField key={value}>
              <input
                type="radio"
                name={`correct_answer_${question.id}`}
                checked={correct === value}
                disabled={saving}
                onChange={() => handlePickCorrect(value)}
              />
              {value}
            </CheckboxField>
          ))}
        </Row>
        {!correct && <HelpText>Choose which answer is correct.</HelpText>}
        {error && <ErrorText role="alert">{error}</ErrorText>}
      </>
    )
  }

  return (
    <>
      {answers.length === 0 && <HelpText>No acceptable answers yet.</HelpText>}
      {answers.length > 0 && (
        <AcceptableAnswerList>
          {answers.map((answer) => {
            if (editingId === answer.id) {
              return (
                <AcceptableAnswerItem key={answer.id}>
                  <AnswerEditForm onSubmit={handleSaveEdit}>
                    <AcceptableAnswerField>
                      <AcceptableAnswerInput
                        type="text"
                        autoFocus
                        aria-label={`Edit acceptable answer ${answer.value}`}
                        inputMode={editDraft.isNumeric ? 'decimal' : 'text'}
                        value={editDraft.value}
                        onChange={(e) => {
                          const raw = e.target.value
                          setEditDraft({
                            ...editDraft,
                            value: editDraft.isNumeric
                              ? filterNumericAnswerInput(raw)
                              : raw,
                          })
                          setError(null)
                        }}
                      />
                      <InlineCheckboxField>
                        <input
                          type="checkbox"
                          checked={editDraft.isNumeric}
                          onChange={(e) => {
                            const isNumeric = e.target.checked
                            setEditDraft({
                              isNumeric,
                              value: isNumeric
                                ? filterNumericAnswerInput(editDraft.value)
                                : editDraft.value,
                            })
                            setError(null)
                          }}
                        />
                        Numeric
                      </InlineCheckboxField>
                    </AcceptableAnswerField>
                    <AnswerItemActions>
                      <AnswerIconButton
                        type="submit"
                        disabled={saving || editDraft.value.trim() === ''}
                        aria-label="Save answer"
                      >
                        <Check size={16} aria-hidden="true" />
                      </AnswerIconButton>
                      <AnswerIconButton
                        type="button"
                        onClick={() => {
                          setEditingId(null)
                          setError(null)
                        }}
                        aria-label="Cancel editing answer"
                      >
                        <X size={16} aria-hidden="true" />
                      </AnswerIconButton>
                    </AnswerItemActions>
                  </AnswerEditForm>
                </AcceptableAnswerItem>
              )
            }

            return (
              <AcceptableAnswerItem key={answer.id}>
                <AcceptableAnswerText>
                  {answer.value}
                  {answer.is_numeric && (
                    <AcceptableAnswerMeta> (numeric)</AcceptableAnswerMeta>
                  )}
                </AcceptableAnswerText>
                {editable && (
                  <AnswerItemActions>
                    <AnswerIconButton
                      type="button"
                      onClick={() => startEdit(answer)}
                      aria-label={`Edit answer ${answer.value}`}
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </AnswerIconButton>
                    <AnswerIconButton
                      type="button"
                      tone="danger"
                      onClick={() => handleDelete(answer)}
                      disabled={deletingId === answer.id}
                      aria-label={
                        deletingId === answer.id
                          ? 'Removing answer'
                          : `Remove answer ${answer.value}`
                      }
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </AnswerIconButton>
                  </AnswerItemActions>
                )}
              </AcceptableAnswerItem>
            )
          })}
        </AcceptableAnswerList>
      )}

      {editable && editingId === null && (
        <AuthForm onSubmit={handleAdd}>
          <Row>
            <AcceptableAnswerField>
              <AcceptableAnswerInput
                type="text"
                placeholder="Acceptable answer value"
                aria-label={`Acceptable answer for question ${question.sequence}`}
                inputMode={draft.isNumeric ? 'decimal' : 'text'}
                value={draft.value}
                onChange={(e) => {
                  const raw = e.target.value
                  setDraft({
                    ...draft,
                    value: draft.isNumeric ? filterNumericAnswerInput(raw) : raw,
                  })
                  setError(null)
                }}
              />
              <InlineCheckboxField>
                <input
                  id={`answer_numeric_${question.id}`}
                  type="checkbox"
                  checked={draft.isNumeric}
                  onChange={(e) => {
                    const isNumeric = e.target.checked
                    setDraft({
                      isNumeric,
                      value: isNumeric
                        ? filterNumericAnswerInput(draft.value)
                        : draft.value,
                    })
                    setError(null)
                  }}
                />
                Numeric
              </InlineCheckboxField>
            </AcceptableAnswerField>
            <Button type="submit" disabled={saving || draft.value.trim() === ''}>
              {pending === 'add' ? 'Adding…' : 'Add answer'}
            </Button>
          </Row>
        </AuthForm>
      )}

      {error && <ErrorText role="alert">{error}</ErrorText>}
    </>
  )
}
