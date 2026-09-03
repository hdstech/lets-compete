import { useEffect, useState } from 'react'
import type { SubmitEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'
import { supabase } from '../../lib/supabase'
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
  approveParticipant,
  getErrorMessage as getParticipantErrorMessage,
  listEventParticipants,
  revokeParticipant,
} from '../participants/participants-api'
import {
  AdmissionBadge,
  ParticipantIdentity,
  ParticipantListEl,
  ParticipantListItem,
  ParticipantMeta,
  ParticipantName,
} from '../participants/participants-ui'
import type { ParticipantRow as ParticipantRecord } from '../participants/types'
import {
  activateEvent,
  assignGrader,
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

  const [graderEmail, setGraderEmail] = useState('')
  const [assigningGrader, setAssigningGrader] = useState(false)
  const [graderError, setGraderError] = useState<string | null>(null)
  const [lastAssignedGraderEmail, setLastAssignedGraderEmail] = useState<string | null>(null)

  const [participants, setParticipants] = useState<ParticipantRecord[] | null>(null)
  const [participantsError, setParticipantsError] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ParticipantRecord | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [participantActionError, setParticipantActionError] = useState<string | null>(null)

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

  function refreshParticipants(id: string) {
    return listEventParticipants(id)
      .then((rows) => setParticipants(rows))
      .catch((err) => {
        setParticipantsError(getParticipantErrorMessage(err, 'Failed to load participants'))
      })
  }

  useEffect(() => {
    if (!eventId) return
    void refreshParticipants(eventId)
  }, [eventId])

  // A participant self-registering (or another admin tab approving/revoking
  // one) should show up here live. Re-fetching on any change is simpler and
  // less error-prone than merging individual payloads into local state.
  useEffect(() => {
    if (!eventId) return

    const channel = supabase
      .channel(`event-detail-participants-${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `event_id=eq.${eventId}` },
        () => {
          void refreshParticipants(eventId)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
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

  async function handleApprove(participantId: string) {
    if (!eventId) return
    setParticipantActionError(null)
    setApprovingId(participantId)
    try {
      await approveParticipant(participantId)
      await refreshParticipants(eventId)
    } catch (err) {
      setParticipantActionError(getParticipantErrorMessage(err, 'Failed to approve participant'))
    } finally {
      setApprovingId(null)
    }
  }

  async function handleRevokeConfirm() {
    if (!eventId || !revokeTarget) return
    const target = revokeTarget
    setRevokeTarget(null)
    setParticipantActionError(null)
    setRevoking(true)
    try {
      await revokeParticipant(target.id)
      await refreshParticipants(eventId)
    } catch (err) {
      setParticipantActionError(getParticipantErrorMessage(err, 'Failed to revoke participant'))
    } finally {
      setRevoking(false)
    }
  }

  async function handleAssignGrader(formEvent: SubmitEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (!eventId) return

    setGraderError(null)
    setAssigningGrader(true)
    try {
      const updated = await assignGrader(eventId, graderEmail)
      setEvent(updated)
      setLastAssignedGraderEmail(graderEmail)
      setGraderEmail('')
    } catch (err) {
      setGraderError(getErrorMessage(err, 'Failed to assign grader'))
    } finally {
      setAssigningGrader(false)
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

      <Card>
        <SectionTitle>Participants</SectionTitle>
        {participantsError && <ErrorText role="alert">{participantsError}</ErrorText>}
        {participantActionError && (
          <ErrorText role="alert">{participantActionError}</ErrorText>
        )}
        {participants === null ? (
          <HelpText>Loading…</HelpText>
        ) : participants.length === 0 ? (
          <HelpText>
            No one has registered yet. Share the join code above to let
            participants self-register.
          </HelpText>
        ) : (
          <ParticipantListEl>
            {participants.map((participant) => (
              <ParticipantListItem key={participant.id}>
                <ParticipantIdentity>
                  <ParticipantName>{participant.name}</ParticipantName>
                  <ParticipantMeta>
                    {participant.type === 'team' ? 'Team' : 'Individual'}
                    {participant.members ? ` · ${participant.members}` : ''}
                  </ParticipantMeta>
                </ParticipantIdentity>
                <Row>
                  <AdmissionBadge admissionStatus={participant.admission_status}>
                    {participant.admission_status}
                  </AdmissionBadge>
                  {participant.admission_status !== 'approved' && (
                    <Button
                      type="button"
                      tone="success"
                      onClick={() => handleApprove(participant.id)}
                      disabled={approvingId === participant.id}
                    >
                      {approvingId === participant.id ? 'Approving…' : 'Approve'}
                    </Button>
                  )}
                  {participant.admission_status !== 'revoked' && (
                    <Button
                      type="button"
                      tone="danger"
                      onClick={() => setRevokeTarget(participant)}
                      disabled={revoking}
                    >
                      Revoke
                    </Button>
                  )}
                </Row>
              </ParticipantListItem>
            ))}
          </ParticipantListEl>
        )}
      </Card>

      <Card>
        <SectionTitle>Grader</SectionTitle>
        <HelpText>
          The grader reviews and confirms auto pre-marked answers once a
          round closes. They sign in with the same emailed link as
          participants — no password needed.
        </HelpText>
        <DefinitionGrid>
          <DefinitionTerm>Status</DefinitionTerm>
          <DefinitionValue>
            {event.grader_id
              ? lastAssignedGraderEmail
                ? `Assigned (${lastAssignedGraderEmail})`
                : 'Assigned'
              : 'Not assigned'}
          </DefinitionValue>
        </DefinitionGrid>
        <AuthForm onSubmit={handleAssignGrader}>
          <Field>
            <Label htmlFor="grader_email">Grader's email</Label>
            <Input
              id="grader_email"
              name="grader_email"
              type="email"
              required
              placeholder="grader@example.com"
              value={graderEmail}
              onChange={(changeEvent) => setGraderEmail(changeEvent.target.value)}
            />
            <HelpText>
              They must have already signed in at least once (via the join
              page) before they can be assigned.
            </HelpText>
          </Field>
          {graderError && <ErrorText role="alert">{graderError}</ErrorText>}
          <Row>
            <SubmitButton type="submit" disabled={assigningGrader}>
              {assigningGrader
                ? 'Assigning…'
                : event.grader_id
                  ? 'Reassign grader'
                  : 'Assign grader'}
            </SubmitButton>
          </Row>
        </AuthForm>
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

      <ConfirmDialog
        open={revokeTarget !== null}
        title="Revoke this participant?"
        description={
          revokeTarget
            ? `${revokeTarget.name} will lose access to this event until re-approved.`
            : ''
        }
        confirmLabel="Revoke"
        tone="danger"
        onConfirm={handleRevokeConfirm}
        onCancel={() => setRevokeTarget(null)}
      />
    </PageContent>
  )
}
