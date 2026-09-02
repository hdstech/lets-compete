import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { ErrorText } from '../auth/auth-ui'
import { listOrganizerEvents } from './events-api'
import {
  EmptyState,
  EventList,
  EventListItem,
  EventListItemTitleRow,
  EventMeta,
  EventName,
  FormatBadge,
  LinkButton,
  PageHeader,
  PageInner,
  PageShell,
  PageSubtitle,
  PageTitle,
  Row,
  StatusBadge,
} from './events-ui'
import type { EventRow } from './types'

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
    <PageShell>
      <PageInner>
        <PageHeader>
          <div>
            <PageTitle>Your events</PageTitle>
            <PageSubtitle>Create and manage the events you organize.</PageSubtitle>
          </div>
          <LinkButton to="/events/new">New event</LinkButton>
        </PageHeader>

        {error && <ErrorText role="alert">{error}</ErrorText>}

        {events === null && !error && <PageSubtitle>Loading…</PageSubtitle>}

        {events !== null && events.length === 0 && (
          <EmptyState>You haven't created an event yet.</EmptyState>
        )}

        {events !== null && events.length > 0 && (
          <EventList>
            {events.map((event) => (
              <EventListItem key={event.id} to={`/events/${event.id}`}>
                <EventListItemTitleRow>
                  <EventName>{event.name}</EventName>
                  <StatusBadge status={event.status}>{event.status}</StatusBadge>
                </EventListItemTitleRow>
                <Row>
                  <FormatBadge>{event.format}</FormatBadge>
                  <EventMeta>
                    {event.event_date ? `Event date: ${event.event_date}` : 'No date set'}
                  </EventMeta>
                  <EventMeta>Join code: {event.join_code}</EventMeta>
                </Row>
              </EventListItem>
            ))}
          </EventList>
        )}
      </PageInner>
    </PageShell>
  )
}
