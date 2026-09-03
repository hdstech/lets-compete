import { Calendar } from 'lucide-react'
import { useEffect, useState } from 'react'
import { styled } from '../../../styled-system/jsx'
import { useAuth } from '../auth/useAuth'
import { ErrorText } from '../auth/auth-ui'
import { LinkButton } from '../../components/ui/Button'
import {
  Title as PageTitle,
  Subtitle as PageSubtitle,
} from '../../components/ui/Typography'
import { listOrganizerEvents } from './events-api'
import {
  EmptyState,
  EmptyStateIcon,
  EventList,
  EventListItem,
  EventListItemTitleRow,
  EventMeta,
  EventName,
  FormatBadge,
  PageHeader,
  Row,
  StatusBadge,
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

  useEffect(() => {
    if (!user) return

    let cancelled = false
    listOrganizerEvents(user.id)
      .then((rows) => {
        if (!cancelled) setEvents(rows)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [user])

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

      {error && <ErrorText role="alert">{error}</ErrorText>}

      {events === null && !error && <PageSubtitle>Loading…</PageSubtitle>}

      {events !== null && events.length === 0 && (
        <EmptyState>
          <EmptyStateIcon>
            <Calendar size={20} />
          </EmptyStateIcon>
          You haven't created an event yet.
        </EmptyState>
      )}

      {events !== null && events.length > 0 && (
        <EventList>
          {events.map((event) => (
            <EventListItem key={event.id} to={`/events/${event.id}`}>
              <EventListItemTitleRow>
                <EventName>{event.name}</EventName>
                <StatusBadge status={event.status}>
                  {event.status}
                </StatusBadge>
              </EventListItemTitleRow>
              <Row>
                <FormatBadge>{event.format}</FormatBadge>
                <EventMeta>
                  {event.event_date
                    ? `Event date: ${event.event_date}`
                    : 'No date set'}
                </EventMeta>
                <EventMeta>Join code: {event.join_code}</EventMeta>
              </Row>
            </EventListItem>
          ))}
        </EventList>
      )}
    </PageContent>
  )
}
