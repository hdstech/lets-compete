import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'
import { combineRealtimeStatus, useRealtimeChannel } from '../../lib/use-realtime-channel'
import { LiveStatusBadge } from '../../components/ui/LiveStatusBadge'
import { useToast } from '../../components/ui/useToast'
import { useAuth } from '../auth/useAuth'
import { AuthLink, LoadingScreen } from '../auth/auth-ui'
import { Card } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/ErrorState'
import { PlayerHeader } from '../../components/ui/PlayerHeader'
import {
  PlayerBody,
  PlayerHeaderBadge,
  PlayerShell,
} from '../../components/ui/PlayerShell'
import { LoadingBlock } from '../../components/ui/LoadingBlock'
import { getEvent } from '../events/events-api'
import type { EventRow } from '../events/types'
import { listRoundQuestions } from '../live-quiz/live-quiz-api'
import { listRounds } from '../rounds/rounds-api'
import { getErrorMessage, getMyParticipant } from './participants-api'
import type { ParticipantRow } from './types'

const StatusMessage = styled('p', {
  base: { fontSize: 'sm', color: 'text.muted' },
})

const StatusActions = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'center',
    fontSize: 'sm',
  },
})

export function WaitingRoomPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { user } = useAuth()
  const { showStatus } = useToast()
  const navigate = useNavigate()

  const [event, setEvent] = useState<EventRow | null>(null)
  const [participant, setParticipant] = useState<ParticipantRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadRegistration = useCallback(() => {
    if (!eventId || !user) return () => {}

    let cancelled = false
    Promise.all([getEvent(eventId), getMyParticipant(eventId, user.id)])
      .then(([eventRow, participantRow]) => {
        if (cancelled) return
        setEvent(eventRow)
        setParticipant(participantRow)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load your registration'))
      })

    return () => {
      cancelled = true
    }
  }, [eventId, user])

  useEffect(() => loadRegistration(), [loadRegistration])

  // Live-updates when the organizer approves/revokes elsewhere, without the
  // participant needing to refresh.
  const participantId = participant?.id ?? null
  const admissionStatus = useRealtimeChannel({
    channelName: participantId ? `waiting-room-${participantId}` : null,
    subscribe: useCallback(
      (channel) =>
        channel.on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'participants',
            filter: `id=eq.${participantId}`,
          },
          (payload) => {
            setParticipant(payload.new as ParticipantRow)
          },
        ),
      [participantId],
    ),
    // An approval granted while the socket was down is exactly what this
    // screen exists to notice, and Postgres Changes won't replay it.
    onReconnect: loadRegistration,
  })

  // Once approved, hand off to the live answering screen (QB4) as soon as
  // the quiz actually starts — not at approval time itself, since approval
  // can happen well before the organizer reveals the first question, and
  // not merely once a round is scoring_open, since activate_event opens
  // round 1 immediately at activation, before any reveal. Two paths in: a
  // reload after the quiz has already started (checked below by looking for
  // an actual revealed question), or a live reveal while this page stays
  // open (the subscription further down).
  const approved = participant?.admission_status === 'approved'
  useEffect(() => {
    if (!eventId || !approved) return

    let cancelled = false
    listRounds(eventId)
      .then(async (rounds) => {
        const openRound = rounds.find((r) => r.status !== 'pending')
        if (!openRound) return
        const questions = await listRoundQuestions(openRound.id)
        if (!cancelled && questions.length > 0) {
          navigate(`/events/${eventId}/play`, { replace: true })
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // Still best-effort — the subscription below catches a reveal that
        // happens while this page stays open — but if the quiz has *already*
        // started, this check was the only thing that would have moved the
        // participant along, and failing it silently strands them here.
        showStatus(
          `Couldn't check whether the quiz has started. ${getErrorMessage(err, 'Reload if you were expecting it to be underway.')}`,
          { key: 'waiting-room-start-check' },
        )
      })

    return () => {
      cancelled = true
    }
  }, [eventId, approved, navigate, showStatus])

  const revealStatus = useRealtimeChannel({
    channelName: eventId && approved ? `waiting-room-questions-${eventId}` : null,
    subscribe: useCallback(
      (channel) =>
        channel.on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'questions' },
          () => {
            navigate(`/events/${eventId}/play`, { replace: true })
          },
        ),
      [eventId, navigate],
    ),
  })

  // The reveal channel only opens once the participant is admitted, so
  // while they're still pending this reports on the admission channel alone.
  const realtimeStatus = combineRealtimeStatus(admissionStatus, revealStatus)

  if (error) {
    return (
      <PlayerShell>
        <PlayerHeader title="Something went wrong" />
        <PlayerBody>
          <Card>
            <ErrorState
              message={error}
              onRetry={() => {
                setError(null)
                loadRegistration()
              }}
            />
          </Card>
        </PlayerBody>
      </PlayerShell>
    )
  }

  if (!event || !participant) {
    return (
      <LoadingScreen>
        <LoadingBlock label="Loading your registration…" />
      </LoadingScreen>
    )
  }

  return (
    <PlayerShell>
      <PlayerHeader
        title={event.name}
        subtitle={`Registered as ${participant.name}`}
      >
        <PlayerHeaderBadge>{participant.admission_status}</PlayerHeaderBadge>
        <LiveStatusBadge status={realtimeStatus} onBrand />
      </PlayerHeader>

      <PlayerBody>
        <Card>
          {participant.admission_status === 'pending' && (
            <StatusMessage>
              Waiting for the organizer to approve you. This page updates
              automatically — no need to refresh.
            </StatusMessage>
          )}

          {participant.admission_status === 'approved' && (
            <StatusMessage>
              You're in! We'll bring you into the quiz here once the organizer
              starts it.
            </StatusMessage>
          )}

          {participant.admission_status === 'revoked' && (
            <StatusMessage>
              You weren't admitted to this event. If you think that's a mistake,
              contact the organizer.
            </StatusMessage>
          )}

          <StatusActions>
            <AuthLink to="/join">Join a different event</AuthLink>
          </StatusActions>
        </Card>
      </PlayerBody>
    </PlayerShell>
  )
}
