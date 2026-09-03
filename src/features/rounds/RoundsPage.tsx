import { useEffect, useState } from 'react'
import type { SubmitEvent } from 'react'
import { useParams } from 'react-router-dom'
import { AuthForm, ErrorText, Field, Input, Label } from '../auth/auth-ui'
import {
  Button,
  Button as SubmitButton,
  LinkButton,
} from '../../components/ui/Button'
import {
  Title as PageTitle,
  Subtitle as PageSubtitle,
} from '../../components/ui/Typography'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
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
import {
  createRound,
  deleteRound,
  getErrorMessage,
  listRounds,
  updateRound,
} from './rounds-api'
import type { RoundInput } from './rounds-api'
import type { RoundRow } from './types'

function nextSequence(rounds: RoundRow[]): number {
  if (rounds.length === 0) return 1
  return Math.max(...rounds.map((round) => round.sequence)) + 1
}

function describeAdvancement(round: RoundRow): string {
  if (round.is_final_round) return 'Final round'
  return `Top ${round.advancement_n} advance`
}

type RoundFormValues = {
  name: string
  sequence: string
  isFinalRound: boolean
  advancementN: string
}

function emptyForm(sequence: number): RoundFormValues {
  return {
    name: '',
    sequence: String(sequence),
    isFinalRound: false,
    advancementN: '',
  }
}

function validate(
  values: RoundFormValues,
  rounds: RoundRow[],
  excludeId: string | null,
): { input: RoundInput } | { error: string } {
  const sequence = Number(values.sequence)
  if (!Number.isInteger(sequence) || sequence < 1) {
    return { error: 'Sequence must be a positive whole number.' }
  }

  const sequenceConflict = rounds.find(
    (r) => r.sequence === sequence && r.id !== excludeId,
  )
  if (sequenceConflict) {
    return {
      error: `Sequence ${sequence} is already used by "${sequenceConflict.name}".`,
    }
  }

  if (values.isFinalRound) {
    const finalConflict = rounds.find(
      (r) => r.is_final_round && r.id !== excludeId,
    )
    if (finalConflict) {
      return {
        error: `Only one round can be final — unmark "${finalConflict.name}" first.`,
      }
    }
    return {
      input: {
        name: values.name,
        sequence,
        isFinalRound: true,
        advancementN: null,
      },
    }
  }

  const advancementN = Number(values.advancementN)
  if (!Number.isInteger(advancementN) || advancementN < 1) {
    return {
      error:
        'Enter how many participants advance, or mark this the final round.',
    }
  }

  return {
    input: { name: values.name, sequence, isFinalRound: false, advancementN },
  }
}

export function RoundsPage() {
  const { eventId } = useParams<{ eventId: string }>()

  const [event, setEvent] = useState<EventRow | null>(null)
  const [rounds, setRounds] = useState<RoundRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [newRound, setNewRound] = useState<RoundFormValues>(emptyForm(1))
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRound, setEditRound] = useState<RoundFormValues>(emptyForm(1))
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [roundPendingDelete, setRoundPendingDelete] = useState<RoundRow | null>(
    null,
  )

  useEffect(() => {
    if (!eventId) return

    let cancelled = false
    Promise.all([getEvent(eventId), listRounds(eventId)])
      .then(([eventRow, roundRows]) => {
        if (cancelled) return
        setEvent(eventRow)
        setRounds(roundRows)
        setNewRound(emptyForm(nextSequence(roundRows)))
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [eventId])

  async function refreshRounds() {
    if (!eventId) return
    const rows = await listRounds(eventId)
    setRounds(rows)
    setNewRound(emptyForm(nextSequence(rows)))
  }

  async function handleAddRound(formEvent: SubmitEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (!eventId || !rounds) return

    setAddError(null)
    const result = validate(newRound, rounds, null)
    if ('error' in result) {
      setAddError(result.error)
      return
    }

    setAdding(true)
    try {
      await createRound(eventId, result.input)
      await refreshRounds()
    } catch (err) {
      setAddError(getErrorMessage(err, 'Failed to create round'))
    } finally {
      setAdding(false)
    }
  }

  function startEdit(round: RoundRow) {
    setEditingId(round.id)
    setEditRound({
      name: round.name,
      sequence: String(round.sequence),
      isFinalRound: round.is_final_round,
      advancementN: round.advancement_n ? String(round.advancement_n) : '',
    })
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

  async function handleSaveEdit(formEvent: SubmitEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (!editingId || !rounds) return

    setEditError(null)
    const result = validate(editRound, rounds, editingId)
    if ('error' in result) {
      setEditError(result.error)
      return
    }

    setSaving(true)
    try {
      await updateRound(editingId, result.input)
      setEditingId(null)
      await refreshRounds()
    } catch (err) {
      setEditError(getErrorMessage(err, 'Failed to save round'))
    } finally {
      setSaving(false)
    }
  }

  function handleDelete(round: RoundRow) {
    setRoundPendingDelete(round)
  }

  async function confirmDelete() {
    if (!roundPendingDelete) return
    const round = roundPendingDelete
    setRoundPendingDelete(null)

    setDeleteError(null)
    setDeletingId(round.id)
    try {
      await deleteRound(round.id)
      await refreshRounds()
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Failed to delete round'))
    } finally {
      setDeletingId(null)
    }
  }

  if (loadError) {
    return (
      <PageShell>
        <PageInner>
          <BackLink to="/events">Back to events</BackLink>
          <ErrorText role="alert">{loadError}</ErrorText>
        </PageInner>
      </PageShell>
    )
  }

  if (!event || !rounds) {
    return (
      <PageShell>
        <PageInner>
          <PageSubtitle>Loading…</PageSubtitle>
        </PageInner>
      </PageShell>
    )
  }

  const isDraft = event.status === 'draft'
  const finalRound = rounds.find((round) => round.is_final_round)

  return (
    <PageShell>
      <PageInner>
        <PageHeader>
          <div>
            <PageTitle>Rounds — {event.name}</PageTitle>
            <PageSubtitle>
              Configure the round(s) participants play and how many advance at
              each cutoff.
            </PageSubtitle>
          </div>
          <Row>
            <LinkButton to={`/events/${event.id}/results`} tone="secondary">
              View results
            </LinkButton>
            <BackLink to={`/events/${event.id}`}>Back to event</BackLink>
          </Row>
        </PageHeader>

        {!isDraft && (
          <HelpText>
            Rounds are frozen because this event is no longer in draft —
            activating an event locks round setup.
          </HelpText>
        )}

        {rounds.length === 0 && <EmptyState>No rounds yet.</EmptyState>}

        {rounds.map((round) =>
          editingId === round.id ? (
            <Card key={round.id}>
              <SectionTitle>Edit round</SectionTitle>
              <AuthForm onSubmit={handleSaveEdit}>
                <Field>
                  <Label htmlFor="round_name">Round name</Label>
                  <Input
                    id="round_name"
                    type="text"
                    required
                    value={editRound.name}
                    onChange={(e) =>
                      setEditRound({ ...editRound, name: e.target.value })
                    }
                  />
                </Field>
                <Field>
                  <Label htmlFor="round_sequence">Sequence</Label>
                  <Input
                    id="round_sequence"
                    type="number"
                    min={1}
                    required
                    value={editRound.sequence}
                    onChange={(e) =>
                      setEditRound({ ...editRound, sequence: e.target.value })
                    }
                  />
                </Field>
                {(!finalRound || finalRound.id === round.id) && (
                  <Field>
                    <CheckboxField>
                      <input
                        type="checkbox"
                        checked={editRound.isFinalRound}
                        onChange={(e) =>
                          setEditRound({
                            ...editRound,
                            isFinalRound: e.target.checked,
                            advancementN: e.target.checked
                              ? ''
                              : editRound.advancementN,
                          })
                        }
                      />
                      This is the final round
                    </CheckboxField>
                  </Field>
                )}
                <Field>
                  <Label htmlFor="round_advancement_n">
                    Participants advancing
                  </Label>
                  <Input
                    id="round_advancement_n"
                    type="number"
                    min={1}
                    required={!editRound.isFinalRound}
                    disabled={editRound.isFinalRound}
                    value={editRound.advancementN}
                    onChange={(e) =>
                      setEditRound({
                        ...editRound,
                        advancementN: e.target.value,
                      })
                    }
                  />
                </Field>
                {editError && <ErrorText role="alert">{editError}</ErrorText>}
                <Row>
                  <SubmitButton type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save round'}
                  </SubmitButton>
                  <Button type="button" tone="secondary" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </Row>
              </AuthForm>
            </Card>
          ) : (
            <Card key={round.id}>
              <SectionTitle>
                Round {round.sequence}: {round.name}
              </SectionTitle>
              <DefinitionGrid>
                <DefinitionTerm>Advancement</DefinitionTerm>
                <DefinitionValue>{describeAdvancement(round)}</DefinitionValue>
                <DefinitionTerm>Status</DefinitionTerm>
                <DefinitionValue>
                  {round.status.replace('_', ' ')}
                </DefinitionValue>
              </DefinitionGrid>
              <Row>
                <LinkButton
                  to={`/events/${event.id}/rounds/${round.id}/segments`}
                  tone="secondary"
                >
                  Manage segments
                </LinkButton>
                {!isDraft && (
                  <LinkButton
                    to={`/events/${event.id}/rounds/${round.id}/live`}
                    tone="primary"
                  >
                    Live console
                  </LinkButton>
                )}
                {(round.status === 'scoring_closed' || round.status === 'advanced') && (
                  <LinkButton
                    to={`/events/${event.id}/rounds/${round.id}/grade`}
                    tone="secondary"
                  >
                    Grade round
                  </LinkButton>
                )}
                {(round.status === 'scoring_closed' || round.status === 'advanced') && (
                  <LinkButton
                    to={`/events/${event.id}/rounds/${round.id}/advance`}
                    tone="secondary"
                  >
                    Review advancement
                  </LinkButton>
                )}
                {isDraft && (
                  <>
                    <Button
                      type="button"
                      tone="secondary"
                      onClick={() => startEdit(round)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      tone="danger"
                      onClick={() => handleDelete(round)}
                      disabled={deletingId === round.id}
                    >
                      {deletingId === round.id ? 'Deleting…' : 'Delete'}
                    </Button>
                  </>
                )}
              </Row>
            </Card>
          ),
        )}

        {deleteError && <ErrorText role="alert">{deleteError}</ErrorText>}

        {isDraft && !editingId && (
          <Card>
            <SectionTitle>Add round</SectionTitle>
            <AuthForm onSubmit={handleAddRound}>
              <Field>
                <Label htmlFor="new_round_name">Round name</Label>
                <Input
                  id="new_round_name"
                  type="text"
                  required
                  value={newRound.name}
                  onChange={(e) =>
                    setNewRound({ ...newRound, name: e.target.value })
                  }
                />
              </Field>
              <Field>
                <Label htmlFor="new_round_sequence">Sequence</Label>
                <Input
                  id="new_round_sequence"
                  type="number"
                  min={1}
                  required
                  value={newRound.sequence}
                  onChange={(e) =>
                    setNewRound({ ...newRound, sequence: e.target.value })
                  }
                />
              </Field>
              {!finalRound && (
                <Field>
                  <CheckboxField>
                    <input
                      type="checkbox"
                      checked={newRound.isFinalRound}
                      onChange={(e) =>
                        setNewRound({
                          ...newRound,
                          isFinalRound: e.target.checked,
                          advancementN: e.target.checked
                            ? ''
                            : newRound.advancementN,
                        })
                      }
                    />
                    This is the final round
                  </CheckboxField>
                </Field>
              )}
              <Field>
                <Label htmlFor="new_round_advancement_n">
                  Participants advancing
                </Label>
                <Input
                  id="new_round_advancement_n"
                  type="number"
                  min={1}
                  required={!newRound.isFinalRound}
                  disabled={newRound.isFinalRound}
                  value={newRound.advancementN}
                  onChange={(e) =>
                    setNewRound({ ...newRound, advancementN: e.target.value })
                  }
                />
              </Field>
              {addError && <ErrorText role="alert">{addError}</ErrorText>}
              <SubmitButton type="submit" disabled={adding}>
                {adding ? 'Adding…' : 'Add round'}
              </SubmitButton>
            </AuthForm>
          </Card>
        )}
      </PageInner>

      <ConfirmDialog
        open={roundPendingDelete !== null}
        title="Delete round"
        description={
          roundPendingDelete
            ? `Delete round "${roundPendingDelete.name}"? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setRoundPendingDelete(null)}
      />
    </PageShell>
  )
}
