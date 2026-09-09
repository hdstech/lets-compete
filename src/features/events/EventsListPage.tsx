import { Calendar } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { styled } from '../../../styled-system/jsx'
import { useAuth } from '../auth/useAuth'
import { Badge } from '../../components/ui/Badge'
import { LinkButton } from '../../components/ui/Button'
import { IconTile } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingBlock } from '../../components/ui/LoadingBlock'
import {
  Title as PageTitle,
  Subtitle as PageSubtitle,
} from '../../components/ui/Typography'
import { getErrorMessage, listOrganizerEvents } from './events-api'
import { EVENT_STATUS_TONE } from './event-status'
import {
  EmptyState,
  EventList,
  EventListItem,
  EventListItemBody,
  EventListItemTitleRow,
  EventMeta,
  EventName,
  PageHeader,
  Row,
} from './events-ui'
import type { EventRow } from './types'

const PageContent = styled('div', {
  base: {
    px: { base: '4', sm: '6' },
    py: { base: '4', sm: '6' },
    display: 'flex',
    flexDirection: 'column',
    gap: '6',
  },
})

export function EventsListPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<EventRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadEvents = useCallback(() => {
    if (!user) return () => {}

    let cancelled = false
    listOrganizerEvents(user.id)
      .then((rows) => {
        if (!cancelled) setEvents(rows)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load your events'))
      })

    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => loadEvents(), [loadEvents])

  return (
    <PageContent>
      <PageHeader>
        <div>
          <PageTitle>Your events</PageTitle>
          <PageSubtitle>
            Create and manage the events you organize.
          </PageSubtitle>
        </div>
        <LinkButton to="/events/new">New event</LinkButton>
      </PageHeader>

      {error && (
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null)
            loadEvents()
          }}
        />
      )}

      {events === null && !error && <LoadingBlock label="Loading your events…" />}

      {events !== null && events.length === 0 && (
        <EmptyState>
          <IconTile tone="subtle" size="lg">
            <Calendar size={22} />
          </IconTile>
          You haven't created an event yet.
        </EmptyState>
      )}

      {events !== null && events.length > 0 && (
        <EventList>
          {events.map((event) => (
            <EventListItem key={event.id} to={`/events/${event.id}`}>
              <IconTile tone="subtle">
                <Calendar size={18} />
              </IconTile>
              <EventListItemBody>
                <EventListItemTitleRow>
                  <EventName>{event.name}</EventName>
                  <Badge tone={EVENT_STATUS_TONE[event.status]}>
                    {event.status}
                  </Badge>
                </EventListItemTitleRow>
                <Row>
                  <Badge>{event.format}</Badge>
                  <EventMeta>
                    {event.event_date
                      ? `Event date: ${event.event_date}`
                      : 'No date set'}
                  </EventMeta>
                  <EventMeta>Join code: {event.join_code}</EventMeta>
                </Row>
              </EventListItemBody>
            </EventListItem>
          ))}
        </EventList>
      )}
    </PageContent>
  )
}
