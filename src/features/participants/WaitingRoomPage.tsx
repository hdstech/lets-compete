import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { AuthLink, AuthShell, ErrorText, LoadingScreen } from '../auth/auth-ui'
import {
  Title as PageTitle,
  Subtitle as PageSubtitle,
} from '../../components/ui/Typography'
import { getEvent } from '../events/events-api'
import type { EventRow } from '../events/types'
import { listRoundQuestions } from '../live-quiz/live-quiz-api'
import { listRounds } from '../rounds/rounds-api'
import { AdmissionBadge } from './participants-ui'
import { getErrorMessage, getMyParticipant } from './participants-api'
import type { ParticipantRow } from './types'

const StatusCard = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4',
    width: 'full',
    maxWidth: '96',
    bg: 'bg.surface',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'card',
    p: '6',
    textAlign: 'center',
    alignItems: 'center',
  },
})

const StatusMessage = styled('p', {
  base: { fontSize: 'sm', color: 'text.muted' },
})

export function WaitingRoomPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [event, setEvent] = useState<EventRow | null>(null)
  const [participant, setParticipant] = useState<ParticipantRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId || !user) return

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

  // Live-updates when the organizer approves/revokes elsewhere, without the
  // participant needing to refresh.
  const participantId = participant?.id ?? null
  useEffect(() => {
    if (!participantId) return

    const channel = supabase
      .channel(`waiting-room-${participantId}`)
      .on(
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
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [participantId])

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
      .catch(() => {
        // Best-effort: the realtime subscription below still catches a
        // reveal that happens while this page stays open.
      })

    return () => {
      cancelled = true
    }
  }, [eventId, approved, navigate])

  useEffect(() => {
    if (!eventId || !approved) return

    const channel = supabase
      .channel(`waiting-room-questions-${eventId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'questions' }, () => {
        navigate(`/events/${eventId}/play`, { replace: true })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, approved, navigate])

  if (error) {
    return (
      <AuthShell>
        <StatusCard>
          <PageTitle>Something went wrong</PageTitle>
          <ErrorText role="alert">{error}</ErrorText>
        </StatusCard>
      </AuthShell>
    )
  }

  if (!event || !participant) {
    return <LoadingScreen>Loading…</LoadingScreen>
  }

  return (
    <AuthShell>
      <StatusCard>
        <div>
          <PageTitle>{event.name}</PageTitle>
          <PageSubtitle>Registered as {participant.name}</PageSubtitle>
        </div>

        <AdmissionBadge admissionStatus={participant.admission_status}>
          {participant.admission_status}
        </AdmissionBadge>

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
            You weren't admitted to this event. If you think that's a
            mistake, contact the organizer.
          </StatusMessage>
        )}

        <AuthLink to="/join">Join a different event</AuthLink>
      </StatusCard>
    </AuthShell>
  )
}
