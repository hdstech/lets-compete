import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
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
