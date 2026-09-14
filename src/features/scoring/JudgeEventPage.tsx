import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'
import { Badge } from '../../components/ui/Badge'
import { Button, LinkButton } from '../../components/ui/Button'
import { Card, CardTitle } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingBlock } from '../../components/ui/LoadingBlock'
import { PlayerHeader } from '../../components/ui/PlayerHeader'
import { PlayerBody, PlayerShell } from '../../components/ui/PlayerShell'
import { useAuth } from '../auth/useAuth'
import { getErrorMessage, getEvent } from '../events/events-api'
import type { EventRow } from '../events/types'
import { ROUND_STATUS_TONE, roundStatusLabel } from '../rounds/round-status'
import { listRounds } from '../rounds/rounds-api'
import type { RoundRow } from '../rounds/types'

const Actions = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '3',
    flexWrap: 'wrap',
  },
})

const RoundHeader = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '3',
  },
})

const StatusMessage = styled('p', {
  base: { fontSize: 'sm', color: 'text.muted' },
})

function isHiddenEvent(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'PGRST116'
  )
}

export function JudgeEventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { user } = useAuth()
  const [event, setEvent] = useState<EventRow | null>(null)
  const [rounds, setRounds] = useState<RoundRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)

  const loadEvent = useCallback(() => {
    if (!eventId || !user) return () => {}

    let cancelled = false

    getEvent(eventId)
      .then(async (eventRow) => {
        if (cancelled) return
        if (eventRow.grader_id !== user.id) {
          setDenied(true)
          return
        }

        const roundRows = await listRounds(eventId)
        if (cancelled) return
        setEvent(eventRow)
        setRounds(roundRows)
      })
      .catch((err) => {
        if (cancelled) return
        if (isHiddenEvent(err)) {
          setDenied(true)
          return
        }
        setError(getErrorMessage(err, 'Failed to load this event'))
      })

    return () => {
      cancelled = true
    }
  }, [eventId, user])

  useEffect(() => loadEvent(), [loadEvent])

  if (denied) {
    return (
      <PlayerShell>
        <PlayerHeader title="Event unavailable" />
        <PlayerBody>
          <ErrorState message="You're not the judge for this event" />
          <LinkButton to="/judge" tone="secondary" width="full">
            Back to your events
          </LinkButton>
        </PlayerBody>
      </PlayerShell>
    )
  }

  if (error) {
    return (
      <PlayerShell>
        <PlayerHeader title="Something went wrong" />
        <PlayerBody>
          <ErrorState
            message={error}
            onRetry={() => {
              setError(null)
              loadEvent()
            }}
          />
          <LinkButton to="/judge" tone="secondary" width="full">
            Back to your events
          </LinkButton>
        </PlayerBody>
      </PlayerShell>
    )
  }

  if (!event || !rounds) {
    return (
      <PlayerShell>
        <PlayerHeader title="Judging" />
        <PlayerBody>
          <LoadingBlock label="Loading event rounds…" />
        </PlayerBody>
      </PlayerShell>
    )
  }

  return (
    <PlayerShell>
      <PlayerHeader
        title={event.name}
        subtitle="Rounds become available after scoring closes."
      />
      <PlayerBody>
        <Actions>
          <LinkButton to="/judge" tone="secondary">
            Back to events
          </LinkButton>
          <Button type="button" tone="secondary" onClick={loadEvent}>
            Refresh
          </Button>
        </Actions>

        {rounds.length === 0 && (
          <Card>
            <StatusMessage>No rounds have been added yet.</StatusMessage>
          </Card>
        )}

        {rounds.map((round) => {
          const ready =
            round.status === 'scoring_closed' || round.status === 'advanced'

          return (
            <Card key={round.id}>
              <RoundHeader>
                <CardTitle>
                  Round {round.sequence}: {round.name}
                </CardTitle>
                <Badge tone={ROUND_STATUS_TONE[round.status]}>
                  {roundStatusLabel(round.status)}
                </Badge>
              </RoundHeader>
              {ready ? (
                <LinkButton
                  to={`/events/${event.id}/rounds/${round.id}/score`}
                  width="full"
                >
                  Score round
                </LinkButton>
              ) : (
                <StatusMessage>Not ready to score yet</StatusMessage>
              )}
            </Card>
          )
        })}
      </PlayerBody>
    </PlayerShell>
  )
}
