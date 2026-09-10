import { Building2, ChevronDown, ChevronUp, Plus } from 'lucide-react'
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

const WORKSPACE_NAME = 'My Organization'

export function SidebarSwitcher({
  railed,
  onExpandSidebar,
}: {
  railed: boolean
  onExpandSidebar: () => void
}) {
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

  // The event list needs the full panel width to be legible, so on the rail the
  // switcher becomes a single icon that opens the sidebar back up and drops the
  // user straight into the expanded list.
  function handleToggle() {
    if (railed) {
      onExpandSidebar()
      setExpanded(true)
      return
    }
    setExpanded((prev) => !prev)
  }

  return (
    <SwitcherRoot>
      <SwitcherToggleButton
        type="button"
        railed={railed}
        onClick={handleToggle}
        aria-expanded={railed ? undefined : expanded}
        aria-label={railed ? WORKSPACE_NAME : undefined}
        title={railed ? WORKSPACE_NAME : undefined}
      >
        {railed ? (
          <Building2 size={16} />
        ) : (
          <>
            <SwitcherToggleText>
              <SwitcherToggleLabel>Workspace</SwitcherToggleLabel>
              <SwitcherToggleName>{WORKSPACE_NAME}</SwitcherToggleName>
            </SwitcherToggleText>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </>
        )}
      </SwitcherToggleButton>

      {expanded && !railed && (
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
