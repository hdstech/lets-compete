import { useEffect, useState } from 'react'
import type { SubmitEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'
import { AuthForm, ErrorText, Field, Input, Label } from '../auth/auth-ui'
import {
  Button,
  Button as SubmitButton,
  LinkButton,
} from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import {
  Title as PageTitle,
  Subtitle as PageSubtitle,
} from '../../components/ui/Typography'
import {
  activateEvent,
  concludeEvent,
  deleteEvent,
  getErrorMessage,
  getEvent,
  updateEvent,
} from './events-api'
import {
  BackLink,
  Card,
  CheckboxField,
  CopyableCode,
  DefinitionGrid,
  DefinitionTerm,
  DefinitionValue,
  FormatBadge,
  HelpText,
  PageHeader,
  Row,
  SectionTitle,
  StatusBadge,
} from './events-ui'
import type { EventRow } from './types'

const PageContent = styled('div', {
  base: {
    px: '6',
    py: '6',
    display: 'flex',
    flexDirection: 'column',
    gap: '6',
  },
})

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()

  const [event, setEvent] = useState<EventRow | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [hasRounds, setHasRounds] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [lifecycleError, setLifecycleError] = useState<string | null>(null)
  const [lifecycleBusy, setLifecycleBusy] = useState(false)

  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!eventId) return

    let cancelled = false
    getEvent(eventId)
      .then((row) => {
        if (cancelled) return
        setEvent(row)
        setName(row.name)
        setEventDate(row.event_date ?? '')
        setHasRounds(row.has_rounds)
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [eventId])

  async function handleSave(formEvent: SubmitEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (!eventId) return

    setSaveError(null)
    setSaved(false)
    setSaving(true)

    try {
      const updated = await updateEvent(eventId, {
        name,
        eventDate: eventDate || null,
        hasRounds,
      })
      setEvent(updated)
      setSaved(true)
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Failed to save changes'))
    } finally {
      setSaving(false)
    }
  }

  async function handleActivate() {
    if (!eventId) return
    setLifecycleError(null)
    setLifecycleBusy(true)
    try {
      const updated = await activateEvent(eventId)
      setEvent(updated)
    } catch (err) {
      setLifecycleError(getErrorMessage(err, 'Failed to activate event'))
    } finally {
      setLifecycleBusy(false)
    }
  }

  async function handleConclude() {
    if (!eventId) return
    setLifecycleError(null)
    setLifecycleBusy(true)
    try {
      const updated = await concludeEvent(eventId)
      setEvent(updated)
    } catch (err) {
      setLifecycleError(getErrorMessage(err, 'Failed to conclude event'))
    } finally {
      setLifecycleBusy(false)
    }
  }

  async function handleDelete() {
    if (!eventId) return

    setConfirmingDelete(false)
    setDeleteError(null)
    setDeleting(true)
    try {
      await deleteEvent(eventId)
      navigate('/events', { replace: true })
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Failed to delete event'))
      setDeleting(false)
    }
  }

  async function handleCopyJoinCode() {
    if (!event) return
    await navigator.clipboard.writeText(event.join_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loadError) {
    return (
      <PageContent>
        <BackLink to="/events">Back to events</BackLink>
        <ErrorText role="alert">{loadError}</ErrorText>
      </PageContent>
    )
  }

  if (!event) {
    return (
      <PageContent>
        <PageSubtitle>Loading…</PageSubtitle>
      </PageContent>
    )
  }

  return (
    <PageContent>
      <PageHeader>
        <div>
          <PageTitle>{event.name}</PageTitle>
          <Row>
            <StatusBadge status={event.status}>{event.status}</StatusBadge>
            <FormatBadge>{event.format}</FormatBadge>
          </Row>
        </div>
        <BackLink to="/events">Back to events</BackLink>
      </PageHeader>

      <Card>
        <SectionTitle>Details</SectionTitle>
        <DefinitionGrid>
          <DefinitionTerm>Join code</DefinitionTerm>
          <DefinitionValue>
            <Row>
              <CopyableCode>{event.join_code}</CopyableCode>
              <Button
                type="button"
                tone="secondary"
                onClick={handleCopyJoinCode}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </Row>
          </DefinitionValue>
          <DefinitionTerm>Created</DefinitionTerm>
          <DefinitionValue>
            {new Date(event.created_at).toLocaleString()}
          </DefinitionValue>
          {event.concluded_at && (
            <>
              <DefinitionTerm>Concluded</DefinitionTerm>
              <DefinitionValue>
                {new Date(event.concluded_at).toLocaleString()}
              </DefinitionValue>
            </>
          )}
        </DefinitionGrid>
      </Card>

      {event.format === 'quiz' && (
        <Card>
          <SectionTitle>Rounds</SectionTitle>
          <HelpText>
            Configure the round(s) participants play and how many advance at
            each cutoff. At least one round must exist before this event can
            be activated.
          </HelpText>
          <Row>
            <LinkButton to={`/events/${event.id}/rounds`} tone="secondary">
              Manage rounds
            </LinkButton>
          </Row>
        </Card>
      )}

      <Card>
        <SectionTitle>Edit event</SectionTitle>
        <AuthForm onSubmit={handleSave}>
          <Field>
            <Label htmlFor="name">Event name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(changeEvent) => {
                setName(changeEvent.target.value)
                setSaved(false)
              }}
            />
          </Field>

          <Field>
            <Label htmlFor="event_date">Event date</Label>
            <Input
              id="event_date"
              name="event_date"
              type="date"
              value={eventDate}
              onChange={(changeEvent) => {
                setEventDate(changeEvent.target.value)
                setSaved(false)
              }}
            />
          </Field>

          <Field>
            <CheckboxField>
              <input
                type="checkbox"
                checked={hasRounds}
                onChange={(changeEvent) => {
                  setHasRounds(changeEvent.target.checked)
                  setSaved(false)
                }}
              />
              This event has elimination rounds
            </CheckboxField>
          </Field>

          {saveError && <ErrorText role="alert">{saveError}</ErrorText>}
          <Row>
            <SubmitButton type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </SubmitButton>
            {saved && <HelpText>Saved.</HelpText>}
          </Row>
        </AuthForm>
      </Card>

      <Card>
        <SectionTitle>Lifecycle</SectionTitle>

        {event.status === 'draft' && (
          <>
            <HelpText>
              Activating opens round 1 for scoring and freezes the
              round/question setup. Make sure at least one round is configured
              first.
            </HelpText>
            <Row>
              <Button
                type="button"
                tone="success"
                onClick={handleActivate}
                disabled={lifecycleBusy}
              >
                {lifecycleBusy ? 'Activating…' : 'Activate event'}
              </Button>
            </Row>
          </>
        )}

        {event.status === 'active' && (
          <>
            <HelpText>
              {event.winner_participant_id
                ? 'A champion has been declared. Concluding is final.'
                : 'Available once a champion has been declared for the final round.'}
            </HelpText>
            <Row>
              <Button
                type="button"
                tone="danger"
                onClick={handleConclude}
                disabled={lifecycleBusy || !event.winner_participant_id}
              >
                {lifecycleBusy ? 'Concluding…' : 'Conclude event'}
              </Button>
            </Row>
          </>
        )}

        {event.status === 'concluded' && (
          <HelpText>This event has concluded.</HelpText>
        )}

        {lifecycleError && (
          <ErrorText role="alert">{lifecycleError}</ErrorText>
        )}
      </Card>

      {event.status === 'draft' && (
        <Card>
          <SectionTitle>Danger zone</SectionTitle>
          <HelpText>
            Deleting a draft event removes it and everything in it.
          </HelpText>
          <Row>
            <Button
              type="button"
              tone="danger"
              onClick={() => setConfirmingDelete(true)}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete event'}
            </Button>
          </Row>
          {deleteError && <ErrorText role="alert">{deleteError}</ErrorText>}
        </Card>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this event?"
        description="Deleting a draft event removes it and everything in it. This cannot be undone."
        confirmLabel="Delete event"
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </PageContent>
  )
}
