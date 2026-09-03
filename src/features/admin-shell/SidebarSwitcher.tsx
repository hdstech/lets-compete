import { ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { ErrorText } from '../auth/auth-ui'
import { getErrorMessage, listOrganizerEvents } from '../events/events-api'
import type { EventRow } from '../events/types'
import {
  SwitcherCreateLink,
  SwitcherEventLink,
  SwitcherEventList,
  SwitcherPanel,
  SwitcherRoot,
  SwitcherStatusText,
  SwitcherToggleButton,
  SwitcherToggleLabel,
  SwitcherToggleName,
  SwitcherToggleText,
} from './admin-shell-ui'

const RECENT_EVENTS_LIMIT = 5

export function SidebarSwitcher() {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [events, setEvents] = useState<EventRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    let cancelled = false
    listOrganizerEvents(user.id)
      .then((rows) => {
        if (!cancelled) setEvents(rows)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load events'))
      })

    return () => {
      cancelled = true
    }
  }, [user])

  const recentEvents = events?.slice(0, RECENT_EVENTS_LIMIT) ?? []

  return (
    <SwitcherRoot>
      <SwitcherToggleButton
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <SwitcherToggleText>
          <SwitcherToggleLabel>Workspace</SwitcherToggleLabel>
          <SwitcherToggleName>My Organization</SwitcherToggleName>
        </SwitcherToggleText>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </SwitcherToggleButton>

      {expanded && (
        <SwitcherPanel>
          {error && <ErrorText role="alert">{error}</ErrorText>}
          {events === null && !error && <SwitcherStatusText>Loading…</SwitcherStatusText>}
          {events !== null && recentEvents.length === 0 && (
            <SwitcherStatusText>No events yet.</SwitcherStatusText>
          )}
          {recentEvents.length > 0 && (
            <SwitcherEventList>
              {recentEvents.map((event) => (
                <SwitcherEventLink key={event.id} to={`/events/${event.id}`}>
                  {event.name}
                </SwitcherEventLink>
              ))}
            </SwitcherEventList>
          )}
          <SwitcherCreateLink to="/events/new">
            <Plus size={14} />
            Create event
          </SwitcherCreateLink>
        </SwitcherPanel>
      )}
    </SwitcherRoot>
  )
}
