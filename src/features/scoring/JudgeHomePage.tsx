import { useCallback, useEffect, useState } from 'react'
import { styled } from '../../../styled-system/jsx'
import { Badge } from '../../components/ui/Badge'
import { LinkButton } from '../../components/ui/Button'
import { Card, CardTitle } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingBlock } from '../../components/ui/LoadingBlock'
import { PlayerHeader } from '../../components/ui/PlayerHeader'
import { PlayerBody, PlayerShell } from '../../components/ui/PlayerShell'
import { useAuth } from '../auth/useAuth'
import {
  getErrorMessage,
  listJudgedEvents,
} from '../events/events-api'
import { EVENT_STATUS_TONE } from '../events/event-status'
import type { EventRow } from '../events/types'

const EventHeader = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '3',
  },
})

const EmptyMessage = styled('p', {
  base: { fontSize: 'sm', color: 'text.muted' },
})

export function JudgeHomePage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<EventRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadEvents = useCallback(() => {
    if (!user) return () => {}

    let cancelled = false
    listJudgedEvents(user.id)
      .then((rows) => {
        if (!cancelled) setEvents(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Failed to load your judging events'))
        }
      })

    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => loadEvents(), [loadEvents])

  return (
    <PlayerShell>
      <PlayerHeader
        title="Your judging events"
        subtitle="Choose an event to view rounds ready for scoring."
      />
      <PlayerBody>
        {error && (
          <ErrorState
            message={error}
            onRetry={() => {
              setError(null)
              loadEvents()
            }}
          />
        )}

        {events === null && !error && (
          <LoadingBlock label="Loading your judging events…" />
        )}

        {events !== null && events.length === 0 && (
          <Card>
            <EmptyMessage>
              You're not the judge for any events yet — ask the organizer to add
              you.
            </EmptyMessage>
          </Card>
        )}

        {events?.map((event) => (
          <Card key={event.id}>
            <EventHeader>
              <CardTitle>{event.name}</CardTitle>
              <Badge tone={EVENT_STATUS_TONE[event.status]}>{event.status}</Badge>
            </EventHeader>
            <LinkButton to={`/events/${event.id}/judge`} width="full">
              View rounds
            </LinkButton>
          </Card>
        ))}
      </PlayerBody>
    </PlayerShell>
  )
}
