import { useCallback, useEffect, useState } from 'react'
import type { SubmitEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'
import { usePageBreadcrumbs } from '../admin-shell/use-breadcrumbs'
import { useRealtimeChannel } from '../../lib/use-realtime-channel'
import { LiveStatusBadge } from '../../components/ui/LiveStatusBadge'
import { useToast } from '../../components/ui/useToast'
import { AuthForm, ErrorText, Field, Input, Label } from '../auth/auth-ui'
import {
  Button,
  Button as SubmitButton,
  LinkButton,
} from '../../components/ui/Button'
import {
  ClipboardCheck,
  Flag,
  Info,
  ListOrdered,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingBlock } from '../../components/ui/LoadingBlock'
import { Title as PageTitle } from '../../components/ui/Typography'
import {
  approveParticipant,
  disqualifyParticipant,
  getErrorMessage as getParticipantErrorMessage,
  listEventParticipants,
  reinstateParticipant,
  revokeParticipant,
} from '../participants/participants-api'
import {
  ADMISSION_TONE,
  ApprovedIcon,
  ELIGIBILITY_TONE,
  ParticipantActions,
  ParticipantIdentity,
  ParticipantListEl,
  ParticipantListItem,
  ParticipantMeta,
  ParticipantName,
} from '../participants/participants-ui'
import type { ParticipantRow as ParticipantRecord } from '../participants/types'
import {
  getErrorMessage as getResultsErrorMessage,
  listFinalCalculations,
  recalculateAffectedScopes,
} from '../results/results-api'
import {
  activateEvent,
  assignJudge,
  concludeEvent,
  deleteEvent,
  getErrorMessage,
  getEvent,
  updateEvent,
} from './events-api'
import { EVENT_STATUS_TONE } from './event-status'
import {
  BackLink,
  CheckboxField,
  CopyableCode,
  DefinitionGrid,
  DefinitionTerm,
  DefinitionValue,
  HelpText,
  PageHeader,
  Row,
  SectionTitle,
} from './events-ui'
import {
  Card,
  CardHeader,
  CardHeaderText,
  IconTile,
} from '../../components/ui/Card'
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
  const { showStatus } = useToast()

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

  const [judgeEmail, setJudgeEmail] = useState('')
  const [assigningJudge, setAssigningJudge] = useState(false)
  const [judgeError, setJudgeError] = useState<string | null>(null)
  const [lastAssignedJudgeEmail, setLastAssignedJudgeEmail] = useState<string | null>(null)

  const [participants, setParticipants] = useState<ParticipantRecord[] | null>(null)
  const [participantsError, setParticipantsError] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ParticipantRecord | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [dqTarget, setDqTarget] = useState<ParticipantRecord | null>(null)
  const [disqualifying, setDisqualifying] = useState(false)
  const [reinstatingId, setReinstatingId] = useState<string | null>(null)
  const [participantActionError, setParticipantActionError] = useState<string | null>(null)

  // Set once a revoke/disqualify leaves at least one already-calculated scope
  // stale — recalculate_results is deliberate, never automatic, so this is
  // an offer, not a side effect of the revoke/disqualify action itself.
  const [recalcPrompt, setRecalcPrompt] = useState<{
    participantName: string
    action: 'revoked' | 'disqualified'
  } | null>(null)
  const [recalculating, setRecalculating] = useState(false)
  const [recalcResult, setRecalcResult] = useState<string | null>(null)
  const [recalcError, setRecalcError] = useState<string | null>(null)

  const loadEvent = useCallback(() => {
    if (!eventId) return () => {}

    let cancelled = false
    getEvent(eventId)
      .then((row) => {
        if (cancelled) return
        setEvent(row)
        setName(row.name)
        setEventDate(row.event_date ?? '')
        setHasRounds(row.has_rounds)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Failed to load this event'))
      })

    return () => {
      cancelled = true
    }
  }, [eventId])

  useEffect(() => loadEvent(), [loadEvent])

  usePageBreadcrumbs(event ? [{ label: event.name }] : [])

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
  const participantsRealtimeStatus = useRealtimeChannel({
    channelName: eventId ? `event-detail-participants-${eventId}` : null,
    subscribe: useCallback(
      (channel) =>
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'participants', filter: `event_id=eq.${eventId}` },
          () => {
            void refreshParticipants(eventId as string)
          },
        ),
      // refreshParticipants is a plain function redeclared each render; the
      // channel only needs to be rebuilt when the event it watches changes.
      [eventId],
    ),
    onReconnect: () => {
      if (eventId) void refreshParticipants(eventId)
    },
  })

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
      await maybeOfferRecalc(target.name, 'revoked')
    } catch (err) {
      setParticipantActionError(getParticipantErrorMessage(err, 'Failed to revoke participant'))
    } finally {
      setRevoking(false)
    }
  }

  async function handleDisqualifyConfirm() {
    if (!eventId || !dqTarget) return
    const target = dqTarget
    setDqTarget(null)
    setParticipantActionError(null)
    setDisqualifying(true)
    try {
      await disqualifyParticipant(target.id)
      await refreshParticipants(eventId)
      await maybeOfferRecalc(target.name, 'disqualified')
    } catch (err) {
      setParticipantActionError(getParticipantErrorMessage(err, 'Failed to disqualify participant'))
    } finally {
      setDisqualifying(false)
    }
  }

  async function handleReinstate(participantId: string) {
    if (!eventId) return
    setParticipantActionError(null)
    setReinstatingId(participantId)
    try {
      await reinstateParticipant(participantId)
      await refreshParticipants(eventId)
    } catch (err) {
      setParticipantActionError(getParticipantErrorMessage(err, 'Failed to reinstate participant'))
    } finally {
      setReinstatingId(null)
    }
  }

  // Only offers a recalculation if there's actually a stale, already-final
  // calculation somewhere in the event — no point prompting for an event
  // that's never had results calculated at all.
  async function maybeOfferRecalc(participantName: string, action: 'revoked' | 'disqualified') {
    if (!eventId) return
    try {
      const finalCalcs = await listFinalCalculations(eventId)
      if (finalCalcs.length > 0) {
        setRecalcResult(null)
        setRecalcPrompt({ participantName, action })
      }
    } catch (err) {
      // Still best-effort — the organizer can recalculate manually from the
      // Results page — but swallowing it meant published results could stay
      // silently stale after a revoke or DQ, with nothing on screen ever
      // having mentioned it.
      showStatus(
        `Couldn't check whether published results need recalculating after this change. ${getResultsErrorMessage(err, 'Recalculate from the Results page to be sure.')}`,
        { key: 'event-detail-recalc-check' },
      )
    }
  }

  async function handleRecalculate() {
    if (!eventId || !recalcPrompt) return
    setRecalculating(true)
    setRecalcError(null)
    try {
      const reason = `Participant ${recalcPrompt.participantName} was ${recalcPrompt.action}`
      const count = await recalculateAffectedScopes(eventId, reason)
      setRecalcResult(`Recalculated ${count} scope${count === 1 ? '' : 's'}.`)
      setRecalcPrompt(null)
    } catch (err) {
      setRecalcError(getResultsErrorMessage(err, 'Failed to recalculate results.'))
    } finally {
      setRecalculating(false)
    }
  }

  async function handleAssignJudge(formEvent: SubmitEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (!eventId) return

    setJudgeError(null)
    setAssigningJudge(true)
    try {
      const updated = await assignJudge(eventId, judgeEmail)
      setEvent(updated)
      setLastAssignedJudgeEmail(judgeEmail)
      setJudgeEmail('')
    } catch (err) {
      setJudgeError(getErrorMessage(err, 'Failed to assign judge'))
    } finally {
      setAssigningJudge(false)
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
        <ErrorState
          message={loadError}
          onRetry={() => {
            setLoadError(null)
            loadEvent()
          }}
        />
      </PageContent>
    )
  }

  if (!event) {
    return (
      <PageContent>
        <LoadingBlock label="Loading event…" />
      </PageContent>
    )
  }

  return (
    <PageContent>
      <PageHeader>
        <div>
          <PageTitle>{event.name}</PageTitle>
          <Row>
            <Badge tone={EVENT_STATUS_TONE[event.status]}>{event.status}</Badge>
            <Badge>{event.format}</Badge>
          </Row>
        </div>
        <BackLink to="/events">Back to events</BackLink>
      </PageHeader>

      <Card>
        <CardHeader>
          <IconTile>
            <Info size={18} />
          </IconTile>
          <CardHeaderText>
            <SectionTitle>Details</SectionTitle>
          </CardHeaderText>
        </CardHeader>
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

      {recalcPrompt && (
        <Card>
          <SectionTitle>Results may be out of date</SectionTitle>
          <HelpText>
            {recalcPrompt.participantName} was {recalcPrompt.action} after results were already
            calculated for this event. Recalculating updates every already-calculated scope to
            exclude them, and records why in the calculation history.
          </HelpText>
          {recalcError && <ErrorText role="alert">{recalcError}</ErrorText>}
          <Row equal>
            <Button
              type="button"
              tone="primary"
              onClick={handleRecalculate}
              disabled={recalculating}
            >
              {recalculating ? 'Recalculating…' : 'Recalculate results'}
            </Button>
            <Button
              type="button"
              tone="secondary"
              onClick={() => setRecalcPrompt(null)}
              disabled={recalculating}
            >
              Dismiss
            </Button>
          </Row>
        </Card>
      )}
      {recalcResult && <HelpText>{recalcResult}</HelpText>}

      <Card>
        <CardHeader>
          <IconTile>
            <Users size={18} />
          </IconTile>
          <CardHeaderText>
            <SectionTitle>Participants</SectionTitle>
          </CardHeaderText>
          {/* Only when it's the bad news: this list is live, and a steady
              "Live" pill on an admin page is noise, but a silently dead
              socket means new registrations never appear here. */}
          {participantsRealtimeStatus === 'interrupted' && (
            <LiveStatusBadge status={participantsRealtimeStatus} />
          )}
        </CardHeader>
        {participantsError && (
          <ErrorState
            message={participantsError}
            onRetry={
              eventId
                ? () => {
                    setParticipantsError(null)
                    void refreshParticipants(eventId)
                  }
                : undefined
            }
          />
        )}
        {participantActionError && (
          <ErrorText role="alert">{participantActionError}</ErrorText>
        )}
        {participants === null && !participantsError ? (
          <LoadingBlock label="Loading participants…" />
        ) : participants === null ? null : participants.length === 0 ? (
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
                <ParticipantActions>
                  <Badge tone={ADMISSION_TONE[participant.admission_status]}>
                    {participant.admission_status === 'approved' && (
                      <ApprovedIcon size={12} />
                    )}
                    {participant.admission_status}
                  </Badge>
                  <Badge tone={ELIGIBILITY_TONE[participant.status]}>
                    {participant.status}
                  </Badge>
                  {participant.admission_status !== 'approved' && (
                    <Button
                      type="button"
                      tone="success"
                      size="sm"
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
                      size="sm"
                      onClick={() => setRevokeTarget(participant)}
                      disabled={revoking}
                    >
                      Revoke
                    </Button>
                  )}
                  {participant.status === 'eligible' && (
                    <Button
                      type="button"
                      tone="danger"
                      size="sm"
                      onClick={() => setDqTarget(participant)}
                      disabled={disqualifying}
                    >
                      Disqualify
                    </Button>
                  )}
                  {participant.status === 'disqualified' && (
                    <Button
                      type="button"
                      tone="success"
                      size="sm"
                      onClick={() => handleReinstate(participant.id)}
                      disabled={reinstatingId === participant.id}
                    >
                      {reinstatingId === participant.id ? 'Reinstating…' : 'Reinstate'}
                    </Button>
                  )}
                </ParticipantActions>
              </ParticipantListItem>
            ))}
          </ParticipantListEl>
        )}
      </Card>

      <Card>
        <CardHeader>
          <IconTile>
            <ClipboardCheck size={18} />
          </IconTile>
          <CardHeaderText>
            <SectionTitle>Judge</SectionTitle>
          </CardHeaderText>
        </CardHeader>
        <HelpText>
          The judge reviews and confirms auto pre-marked answers once a
          round closes. They sign in with the same emailed link as
          participants — no password needed.
        </HelpText>
        <DefinitionGrid>
          <DefinitionTerm>Status</DefinitionTerm>
          <DefinitionValue>
            {event.grader_id
              ? lastAssignedJudgeEmail
                ? `Assigned (${lastAssignedJudgeEmail})`
                : 'Assigned'
              : 'Not assigned'}
          </DefinitionValue>
        </DefinitionGrid>
        <AuthForm onSubmit={handleAssignJudge}>
          <Field>
            <Label htmlFor="judge_email">Judge's email</Label>
            <Input
              id="judge_email"
              name="judge_email"
              type="email"
              required
              placeholder="judge@example.com"
              value={judgeEmail}
              onChange={(changeEvent) => setJudgeEmail(changeEvent.target.value)}
            />
            <HelpText>
              They must have already signed in at least once (via the join
              page) before they can be assigned.
            </HelpText>
          </Field>
          {judgeError && <ErrorText role="alert">{judgeError}</ErrorText>}
          <Row>
            <SubmitButton type="submit" disabled={assigningJudge}>
              {assigningJudge
                ? 'Assigning…'
                : event.grader_id
                  ? 'Reassign judge'
                  : 'Assign judge'}
            </SubmitButton>
          </Row>
        </AuthForm>
      </Card>

      {event.format === 'quiz' && (
        <Card>
          <CardHeader>
            <IconTile>
              <ListOrdered size={18} />
            </IconTile>
            <CardHeaderText>
              <SectionTitle>Rounds</SectionTitle>
            </CardHeaderText>
          </CardHeader>
          <HelpText>
            Configure the round(s) participants play and how many advance at
            each cutoff. At least one round must exist before this event can
            be activated.
          </HelpText>
          <Row>
            <LinkButton to={`/events/${event.id}/rounds`} tone="accent">
              Manage rounds
            </LinkButton>
          </Row>
        </Card>
      )}

      <Card>
        <CardHeader>
          <IconTile tone="subtle">
            <Pencil size={18} />
          </IconTile>
          <CardHeaderText>
            <SectionTitle>Edit event</SectionTitle>
          </CardHeaderText>
        </CardHeader>
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
        <CardHeader>
          <IconTile>
            <Flag size={18} />
          </IconTile>
          <CardHeaderText>
            <SectionTitle>Lifecycle</SectionTitle>
          </CardHeaderText>
        </CardHeader>

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
          <CardHeader>
            <IconTile tone="danger">
              <Trash2 size={18} />
            </IconTile>
            <CardHeaderText>
              <SectionTitle>Danger zone</SectionTitle>
            </CardHeaderText>
          </CardHeader>
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

      <ConfirmDialog
        open={dqTarget !== null}
        title="Disqualify this participant?"
        description={
          dqTarget
            ? `${dqTarget.name} will be excluded from any results calculated after this. Already-calculated results are unaffected until you recalculate them.`
            : ''
        }
        confirmLabel="Disqualify"
        tone="danger"
        onConfirm={handleDisqualifyConfirm}
        onCancel={() => setDqTarget(null)}
      />
    </PageContent>
  )
}
