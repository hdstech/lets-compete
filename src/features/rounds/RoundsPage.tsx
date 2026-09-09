import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingBlock } from '../../components/ui/LoadingBlock'
import { usePageBreadcrumbs, useUnsavedChanges } from '../admin-shell/use-breadcrumbs'
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
  createSegment,
  deleteSegment,
  listSegments,
  updateSegment,
} from '../segments/segments-api'
import type { SegmentInput } from '../segments/segments-api'
import type { SegmentRow } from '../segments/types'
import {
  SegmentActions,
  SegmentList,
  SegmentRowItem,
  SegmentRowMain,
  SegmentTitle,
} from './rounds-ui'
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

function nextSegmentSequence(segments: SegmentRow[]): number {
  if (segments.length === 0) return 1
  return Math.max(...segments.map((segment) => segment.sequence)) + 1
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

type SegmentFormValues = { name: string; sequence: string }

function emptySegmentForm(sequence: number): SegmentFormValues {
  return { name: '', sequence: String(sequence) }
}

function validateSegment(
  values: SegmentFormValues,
  segments: SegmentRow[],
  excludeId: string | null,
): { input: SegmentInput } | { error: string } {
  const sequence = Number(values.sequence)
  if (!Number.isInteger(sequence) || sequence < 1) {
    return { error: 'Segment order must be a positive whole number.' }
  }

  const sequenceConflict = segments.find(
    (s) => s.sequence === sequence && s.id !== excludeId,
  )
  if (sequenceConflict) {
    return {
      error: `Order ${sequence} is already used by "${sequenceConflict.name}".`,
    }
  }

  return { input: { name: values.name, sequence } }
}

export function RoundsPage() {
  const { eventId } = useParams<{ eventId: string }>()

  const [event, setEvent] = useState<EventRow | null>(null)
  const [rounds, setRounds] = useState<RoundRow[] | null>(null)
  const [segmentsByRound, setSegmentsByRound] = useState<
    Record<string, SegmentRow[]>
  >({})
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

  // Segment authoring is inline per round card. These maps are keyed by round
  // id so several rounds can each host their own add form independently.
  const [newSegment, setNewSegment] = useState<Record<string, SegmentFormValues>>(
    {},
  )
  // Which round cards currently have their add-segment form revealed. The
  // inputs stay hidden behind an "Add segment" button until the organizer
  // opts in, keeping each card compact by default.
  const [segmentFormOpen, setSegmentFormOpen] = useState<
    Record<string, boolean>
  >({})
  const [segmentAddError, setSegmentAddError] = useState<
    Record<string, string | null>
  >({})
  const [addingSegmentFor, setAddingSegmentFor] = useState<string | null>(null)

  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)
  const [editSegment, setEditSegment] = useState<SegmentFormValues>(
    emptySegmentForm(1),
  )
  const [segmentEditError, setSegmentEditError] = useState<string | null>(null)
  const [savingSegment, setSavingSegment] = useState(false)

  const [segmentDeleteError, setSegmentDeleteError] = useState<string | null>(
    null,
  )
  const [deletingSegmentId, setDeletingSegmentId] = useState<string | null>(null)

  usePageBreadcrumbs(
    event
      ? [
          { label: event.name, to: `/events/${event.id}` },
          { label: 'Rounds' },
        ]
      : [{ label: 'Rounds' }],
  )

  // Anything typed into an add form, or an in-progress inline edit, counts as
  // unsaved work worth warning about before breadcrumb navigation.
  useUnsavedChanges(
    editingId !== null ||
      editingSegmentId !== null ||
      newRound.name.trim() !== '' ||
      Object.values(newSegment).some((form) => form.name.trim() !== ''),
  )

  async function loadSegmentsMap(
    roundRows: RoundRow[],
  ): Promise<Record<string, SegmentRow[]>> {
    const lists = await Promise.all(
      roundRows.map((round) => listSegments(round.id)),
    )
    const map: Record<string, SegmentRow[]> = {}
    roundRows.forEach((round, i) => {
      map[round.id] = lists[i]
    })
    return map
  }

  const loadData = useCallback(() => {
    if (!eventId) return () => {}

    let cancelled = false
    Promise.all([getEvent(eventId), listRounds(eventId)])
      .then(async ([eventRow, roundRows]) => {
        if (cancelled) return
        const segmentMap = await loadSegmentsMap(roundRows)
        if (cancelled) return
        setEvent(eventRow)
        setRounds(roundRows)
        setSegmentsByRound(segmentMap)
        setNewRound(emptyForm(nextSequence(roundRows)))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Failed to load rounds'))
      })

    return () => {
      cancelled = true
    }
  }, [eventId])

  useEffect(() => loadData(), [loadData])

  async function refreshRounds() {
    if (!eventId) return
    const rows = await listRounds(eventId)
    const segmentMap = await loadSegmentsMap(rows)
    setRounds(rows)
    setSegmentsByRound(segmentMap)
    setNewRound(emptyForm(nextSequence(rows)))
  }

  async function refreshSegments(roundId: string) {
    const rows = await listSegments(roundId)
    setSegmentsByRound((prev) => ({ ...prev, [roundId]: rows }))
    return rows
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

  function segmentFormFor(round: RoundRow): SegmentFormValues {
    return (
      newSegment[round.id] ??
      emptySegmentForm(nextSegmentSequence(segmentsByRound[round.id] ?? []))
    )
  }

  function openSegmentForm(round: RoundRow) {
    setSegmentAddError((prev) => ({ ...prev, [round.id]: null }))
    setSegmentFormOpen((prev) => ({ ...prev, [round.id]: true }))
  }

  function closeSegmentForm(round: RoundRow) {
    setSegmentFormOpen((prev) => ({ ...prev, [round.id]: false }))
    setSegmentAddError((prev) => ({ ...prev, [round.id]: null }))
    setNewSegment((prev) => ({
      ...prev,
      [round.id]: emptySegmentForm(
        nextSegmentSequence(segmentsByRound[round.id] ?? []),
      ),
    }))
  }

  async function handleAddSegment(
    formEvent: SubmitEvent<HTMLFormElement>,
    round: RoundRow,
  ) {
    formEvent.preventDefault()
    const segments = segmentsByRound[round.id] ?? []
    const form = segmentFormFor(round)

    setSegmentAddError((prev) => ({ ...prev, [round.id]: null }))
    const result = validateSegment(form, segments, null)
    if ('error' in result) {
      setSegmentAddError((prev) => ({ ...prev, [round.id]: result.error }))
      return
    }

    setAddingSegmentFor(round.id)
    try {
      await createSegment(round.id, result.input)
      const rows = await refreshSegments(round.id)
      setNewSegment((prev) => ({
        ...prev,
        [round.id]: emptySegmentForm(nextSegmentSequence(rows)),
      }))
      // Collapse back to the "Add segment" button once the segment lands.
      setSegmentFormOpen((prev) => ({ ...prev, [round.id]: false }))
    } catch (err) {
      setSegmentAddError((prev) => ({
        ...prev,
        [round.id]: getErrorMessage(err, 'Failed to create segment'),
      }))
    } finally {
      setAddingSegmentFor(null)
    }
  }

  function startEditSegment(segment: SegmentRow) {
    setEditingSegmentId(segment.id)
    setEditSegment({ name: segment.name, sequence: String(segment.sequence) })
    setSegmentEditError(null)
  }

  function cancelEditSegment() {
    setEditingSegmentId(null)
    setSegmentEditError(null)
  }

  async function handleSaveSegment(
    formEvent: SubmitEvent<HTMLFormElement>,
    round: RoundRow,
  ) {
    formEvent.preventDefault()
    if (!editingSegmentId) return
    const segments = segmentsByRound[round.id] ?? []

    setSegmentEditError(null)
    const result = validateSegment(editSegment, segments, editingSegmentId)
    if ('error' in result) {
      setSegmentEditError(result.error)
      return
    }

    setSavingSegment(true)
    try {
      await updateSegment(editingSegmentId, result.input)
      setEditingSegmentId(null)
      await refreshSegments(round.id)
    } catch (err) {
      setSegmentEditError(getErrorMessage(err, 'Failed to save segment'))
    } finally {
      setSavingSegment(false)
    }
  }

  async function handleDeleteSegment(segment: SegmentRow) {
    if (
      !window.confirm(
        `Delete segment "${segment.name}"? This cannot be undone.`,
      )
    )
      return

    setSegmentDeleteError(null)
    setDeletingSegmentId(segment.id)
    try {
      await deleteSegment(segment.id)
      await refreshSegments(segment.round_id)
    } catch (err) {
      setSegmentDeleteError(getErrorMessage(err, 'Failed to delete segment'))
    } finally {
      setDeletingSegmentId(null)
    }
  }

  if (loadError) {
    return (
      <PageShell>
        <PageInner>
          <BackLink to="/events">Back to events</BackLink>
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

  if (!event || !rounds) {
    return (
      <PageShell>
        <PageInner>
          <LoadingBlock label="Loading rounds…" />
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
                <Row equal>
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
            <Card
              key={round.id}
              role="group"
              aria-label={`Round ${round.sequence}: ${round.name}`}
            >
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

              <SectionTitle>Segments</SectionTitle>
              {(segmentsByRound[round.id] ?? []).length === 0 && (
                <HelpText>No segments yet.</HelpText>
              )}
              <SegmentList>
                {(segmentsByRound[round.id] ?? []).map((segment) =>
                  editingSegmentId === segment.id ? (
                    <SegmentRowItem key={segment.id}>
                      <AuthForm onSubmit={(e) => handleSaveSegment(e, round)}>
                        <Field>
                          <Label htmlFor={`segment_name_${segment.id}`}>
                            Segment name
                          </Label>
                          <Input
                            id={`segment_name_${segment.id}`}
                            type="text"
                            required
                            value={editSegment.name}
                            onChange={(e) =>
                              setEditSegment({
                                ...editSegment,
                                name: e.target.value,
                              })
                            }
                          />
                        </Field>
                        <Field>
                          <Label htmlFor={`segment_order_${segment.id}`}>
                            Segment order
                          </Label>
                          <Input
                            id={`segment_order_${segment.id}`}
                            type="number"
                            min={1}
                            required
                            value={editSegment.sequence}
                            onChange={(e) =>
                              setEditSegment({
                                ...editSegment,
                                sequence: e.target.value,
                              })
                            }
                          />
                        </Field>
                        {segmentEditError && (
                          <ErrorText role="alert">{segmentEditError}</ErrorText>
                        )}
                        <Row equal>
                          <SubmitButton type="submit" disabled={savingSegment}>
                            {savingSegment ? 'Saving…' : 'Save segment'}
                          </SubmitButton>
                          <Button
                            type="button"
                            tone="secondary"
                            onClick={cancelEditSegment}
                          >
                            Cancel
                          </Button>
                        </Row>
                      </AuthForm>
                    </SegmentRowItem>
                  ) : (
                    <SegmentRowItem key={segment.id} interactive>
                      <SegmentRowMain>
                        <SegmentTitle>
                          Segment {segment.sequence}: {segment.name}
                        </SegmentTitle>
                        <SegmentActions>
                          <LinkButton
                            to={`/events/${event.id}/rounds/${round.id}/segments/${segment.id}/questions`}
                            tone="secondary"
                            size="sm"
                          >
                            Manage questions
                          </LinkButton>
                          {isDraft && (
                            <>
                              <Button
                                type="button"
                                tone="secondary"
                                size="sm"
                                onClick={() => startEditSegment(segment)}
                              >
                                Edit segment
                              </Button>
                              <Button
                                type="button"
                                tone="danger"
                                size="sm"
                                onClick={() => handleDeleteSegment(segment)}
                                disabled={deletingSegmentId === segment.id}
                              >
                                {deletingSegmentId === segment.id
                                  ? 'Deleting…'
                                  : 'Delete segment'}
                              </Button>
                            </>
                          )}
                        </SegmentActions>
                      </SegmentRowMain>
                    </SegmentRowItem>
                  ),
                )}
              </SegmentList>

              {isDraft &&
                editingSegmentId === null &&
                (segmentFormOpen[round.id] ? (
                  <SegmentRowItem>
                    <AuthForm onSubmit={(e) => handleAddSegment(e, round)}>
                      <Field>
                        <Label htmlFor={`new_segment_name_${round.id}`}>
                          Segment name
                        </Label>
                        <Input
                          id={`new_segment_name_${round.id}`}
                          type="text"
                          required
                          value={segmentFormFor(round).name}
                          onChange={(e) =>
                            setNewSegment((prev) => ({
                              ...prev,
                              [round.id]: {
                                ...segmentFormFor(round),
                                name: e.target.value,
                              },
                            }))
                          }
                        />
                      </Field>
                      <Field>
                        <Label htmlFor={`new_segment_order_${round.id}`}>
                          Segment order
                        </Label>
                        <Input
                          id={`new_segment_order_${round.id}`}
                          type="number"
                          min={1}
                          required
                          value={segmentFormFor(round).sequence}
                          onChange={(e) =>
                            setNewSegment((prev) => ({
                              ...prev,
                              [round.id]: {
                                ...segmentFormFor(round),
                                sequence: e.target.value,
                              },
                            }))
                          }
                        />
                      </Field>
                      {segmentAddError[round.id] && (
                        <ErrorText role="alert">
                          {segmentAddError[round.id]}
                        </ErrorText>
                      )}
                      <Row equal>
                        <SubmitButton
                          type="submit"
                          disabled={addingSegmentFor === round.id}
                        >
                          {addingSegmentFor === round.id
                            ? 'Adding…'
                            : 'Save segment'}
                        </SubmitButton>
                        <Button
                          type="button"
                          tone="secondary"
                          onClick={() => closeSegmentForm(round)}
                        >
                          Cancel
                        </Button>
                      </Row>
                    </AuthForm>
                  </SegmentRowItem>
                ) : (
                  <Button
                    type="button"
                    tone="secondary"
                    py="3"
                    onClick={() => openSegmentForm(round)}
                  >
                    <Plus size={16} />
                    Add segment
                  </Button>
                ))}

              <Row equal>
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
                    to={`/events/${event.id}/rounds/${round.id}/score`}
                    tone="secondary"
                  >
                    Score round
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
              {segmentDeleteError && (
                <ErrorText role="alert">{segmentDeleteError}</ErrorText>
              )}
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
