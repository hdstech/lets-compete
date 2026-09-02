import { useEffect, useState } from 'react'
import type { SubmitEvent } from 'react'
import { useParams } from 'react-router-dom'
import { AuthForm, ErrorText, Field, Input, Label, SubmitButton } from '../auth/auth-ui'
import { getEvent } from '../events/events-api'
import {
  BackLink,
  Button,
  Card,
  DefinitionGrid,
  DefinitionTerm,
  DefinitionValue,
  EmptyState,
  HelpText,
  LinkButton,
  PageHeader,
  PageInner,
  PageShell,
  PageSubtitle,
  PageTitle,
  Row,
  SectionTitle,
} from '../events/events-ui'
import type { EventRow } from '../events/types'
import { getRound } from '../rounds/rounds-api'
import type { RoundRow } from '../rounds/types'
import {
  createSegment,
  deleteSegment,
  getErrorMessage,
  listSegments,
  updateSegment,
} from './segments-api'
import type { SegmentInput } from './segments-api'
import type { SegmentRow } from './types'

function nextSequence(segments: SegmentRow[]): number {
  if (segments.length === 0) return 1
  return Math.max(...segments.map((segment) => segment.sequence)) + 1
}

type SegmentFormValues = {
  name: string
  sequence: string
}

function emptyForm(sequence: number): SegmentFormValues {
  return { name: '', sequence: String(sequence) }
}

function validate(
  values: SegmentFormValues,
  segments: SegmentRow[],
  excludeId: string | null,
): { input: SegmentInput } | { error: string } {
  const sequence = Number(values.sequence)
  if (!Number.isInteger(sequence) || sequence < 1) {
    return { error: 'Sequence must be a positive whole number.' }
  }

  const sequenceConflict = segments.find((s) => s.sequence === sequence && s.id !== excludeId)
  if (sequenceConflict) {
    return { error: `Sequence ${sequence} is already used by "${sequenceConflict.name}".` }
  }

  return { input: { name: values.name, sequence } }
}

export function SegmentsPage() {
  const { eventId, roundId } = useParams<{ eventId: string; roundId: string }>()

  const [event, setEvent] = useState<EventRow | null>(null)
  const [round, setRound] = useState<RoundRow | null>(null)
  const [segments, setSegments] = useState<SegmentRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [newSegment, setNewSegment] = useState<SegmentFormValues>(emptyForm(1))
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSegment, setEditSegment] = useState<SegmentFormValues>(emptyForm(1))
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId || !roundId) return

    let cancelled = false
    Promise.all([getEvent(eventId), getRound(roundId), listSegments(roundId)])
      .then(([eventRow, roundRow, segmentRows]) => {
        if (cancelled) return
        setEvent(eventRow)
        setRound(roundRow)
        setSegments(segmentRows)
        setNewSegment(emptyForm(nextSequence(segmentRows)))
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [eventId, roundId])

  async function refreshSegments() {
    if (!roundId) return
    const rows = await listSegments(roundId)
    setSegments(rows)
    setNewSegment(emptyForm(nextSequence(rows)))
  }

  async function handleAddSegment(formEvent: SubmitEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (!roundId || !segments) return

    setAddError(null)
    const result = validate(newSegment, segments, null)
    if ('error' in result) {
      setAddError(result.error)
      return
    }

    setAdding(true)
    try {
      await createSegment(roundId, result.input)
      await refreshSegments()
    } catch (err) {
      setAddError(getErrorMessage(err, 'Failed to create segment'))
    } finally {
      setAdding(false)
    }
  }

  function startEdit(segment: SegmentRow) {
    setEditingId(segment.id)
    setEditSegment({ name: segment.name, sequence: String(segment.sequence) })
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

  async function handleSaveEdit(formEvent: SubmitEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (!editingId || !segments) return

    setEditError(null)
    const result = validate(editSegment, segments, editingId)
    if ('error' in result) {
      setEditError(result.error)
      return
    }

    setSaving(true)
    try {
      await updateSegment(editingId, result.input)
      setEditingId(null)
      await refreshSegments()
    } catch (err) {
      setEditError(getErrorMessage(err, 'Failed to save segment'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(segment: SegmentRow) {
    if (!window.confirm(`Delete segment "${segment.name}"? This cannot be undone.`)) return

    setDeleteError(null)
    setDeletingId(segment.id)
    try {
      await deleteSegment(segment.id)
      await refreshSegments()
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Failed to delete segment'))
    } finally {
      setDeletingId(null)
    }
  }

  if (loadError) {
    return (
      <PageShell>
        <PageInner>
          <BackLink to={`/events/${eventId}/rounds`}>Back to rounds</BackLink>
          <ErrorText role="alert">{loadError}</ErrorText>
        </PageInner>
      </PageShell>
    )
  }

  if (!event || !round || !segments) {
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
            <PageTitle>
              Segments — Round {round.sequence}: {round.name}
            </PageTitle>
            <PageSubtitle>
              Group this round's questions into segments (e.g. "History", "Science").
            </PageSubtitle>
          </div>
          <BackLink to={`/events/${event.id}/rounds`}>Back to rounds</BackLink>
        </PageHeader>

        {!isDraft && (
          <HelpText>
            Segments are frozen because this event is no longer in draft — activating an event
            locks segment setup.
          </HelpText>
        )}

        {segments.length === 0 && <EmptyState>No segments yet.</EmptyState>}

        {segments.map((segment) =>
          editingId === segment.id ? (
            <Card key={segment.id}>
              <SectionTitle>Edit segment</SectionTitle>
              <AuthForm onSubmit={handleSaveEdit}>
                <Field>
                  <Label htmlFor="segment_name">Segment name</Label>
                  <Input
                    id="segment_name"
                    type="text"
                    required
                    value={editSegment.name}
                    onChange={(e) => setEditSegment({ ...editSegment, name: e.target.value })}
                  />
                </Field>
                <Field>
                  <Label htmlFor="segment_sequence">Sequence</Label>
                  <Input
                    id="segment_sequence"
                    type="number"
                    min={1}
                    required
                    value={editSegment.sequence}
                    onChange={(e) => setEditSegment({ ...editSegment, sequence: e.target.value })}
                  />
                </Field>
                {editError && <ErrorText role="alert">{editError}</ErrorText>}
                <Row>
                  <SubmitButton type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save segment'}
                  </SubmitButton>
                  <Button type="button" tone="secondary" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </Row>
              </AuthForm>
            </Card>
          ) : (
            <Card key={segment.id}>
              <SectionTitle>
                Segment {segment.sequence}: {segment.name}
              </SectionTitle>
              <DefinitionGrid>
                <DefinitionTerm>Sequence</DefinitionTerm>
                <DefinitionValue>{segment.sequence}</DefinitionValue>
              </DefinitionGrid>
              <Row>
                <LinkButton
                  to={`/events/${event.id}/rounds/${round.id}/segments/${segment.id}/questions`}
                  tone="secondary"
                >
                  Manage questions
                </LinkButton>
                {isDraft && (
                  <>
                    <Button type="button" tone="secondary" onClick={() => startEdit(segment)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      tone="danger"
                      onClick={() => handleDelete(segment)}
                      disabled={deletingId === segment.id}
                    >
                      {deletingId === segment.id ? 'Deleting…' : 'Delete'}
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
            <SectionTitle>Add segment</SectionTitle>
            <AuthForm onSubmit={handleAddSegment}>
              <Field>
                <Label htmlFor="new_segment_name">Segment name</Label>
                <Input
                  id="new_segment_name"
                  type="text"
                  required
                  value={newSegment.name}
                  onChange={(e) => setNewSegment({ ...newSegment, name: e.target.value })}
                />
              </Field>
              <Field>
                <Label htmlFor="new_segment_sequence">Sequence</Label>
                <Input
                  id="new_segment_sequence"
                  type="number"
                  min={1}
                  required
                  value={newSegment.sequence}
                  onChange={(e) => setNewSegment({ ...newSegment, sequence: e.target.value })}
                />
              </Field>
              {addError && <ErrorText role="alert">{addError}</ErrorText>}
              <SubmitButton type="submit" disabled={adding}>
                {adding ? 'Adding…' : 'Add segment'}
              </SubmitButton>
            </AuthForm>
          </Card>
        )}
      </PageInner>
    </PageShell>
  )
}
