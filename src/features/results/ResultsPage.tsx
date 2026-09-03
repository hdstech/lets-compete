import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ErrorText } from '../auth/auth-ui'
import { Button, LinkButton } from '../../components/ui/Button'
import {
  Title as PageTitle,
  Subtitle as PageSubtitle,
} from '../../components/ui/Typography'
import { getEvent } from '../events/events-api'
import {
  BackLink,
  EmptyState,
  HelpText,
  PageHeader,
  PageInner,
  PageShell,
  Row,
  SectionTitle,
} from '../events/events-ui'
import type { EventRow } from '../events/types'
import { listEventParticipants } from '../participants/participants-api'
import type { ParticipantRow } from '../participants/types'
import { listRounds } from '../rounds/rounds-api'
import type { RoundRow } from '../rounds/types'
import { listSegments } from '../segments/segments-api'
import type { SegmentRow } from '../segments/types'
import {
  calculateResults,
  getErrorMessage,
  listCalculationEntries,
  listFinalCalculations,
  scopeKey,
} from './results-api'
import { ResultBoard } from './ResultBoard'
import { BoardHeader, RoundSection } from './results-ui'
import type { ResultCalculationEntryRow, ResultCalculationRow } from './types'

export function ResultsPage() {
  const { eventId } = useParams<{ eventId: string }>()

  const [event, setEvent] = useState<EventRow | null>(null)
  const [rounds, setRounds] = useState<RoundRow[] | null>(null)
  const [segmentsByRound, setSegmentsByRound] = useState<Record<string, SegmentRow[]> | null>(
    null,
  )
  const [participants, setParticipants] = useState<ParticipantRow[] | null>(null)
  const [calculations, setCalculations] = useState<ResultCalculationRow[] | null>(null)
  const [entries, setEntries] = useState<ResultCalculationEntryRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [calculatingRoundId, setCalculatingRoundId] = useState<string | null>(null)
  const [calculatingOverall, setCalculatingOverall] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId) return

    let cancelled = false
    Promise.all([getEvent(eventId), listRounds(eventId), listEventParticipants(eventId)])
      .then(async ([eventRow, roundRows, participantRows]) => {
        if (cancelled) return
        const [segmentLists, calcRows] = await Promise.all([
          Promise.all(roundRows.map((round) => listSegments(round.id))),
          listFinalCalculations(eventId),
        ])
        const entryRows = await listCalculationEntries(calcRows.map((calc) => calc.id))
        if (cancelled) return

        setEvent(eventRow)
        setRounds(roundRows)
        setSegmentsByRound(
          Object.fromEntries(roundRows.map((round, i) => [round.id, segmentLists[i]])),
        )
        setParticipants(participantRows)
        setCalculations(calcRows)
        setEntries(entryRows)
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [eventId])

  async function reloadResults() {
    if (!eventId) return
    const calcRows = await listFinalCalculations(eventId)
    const entryRows = await listCalculationEntries(calcRows.map((calc) => calc.id))
    setCalculations(calcRows)
    setEntries(entryRows)
  }

  const participantsById = useMemo(() => {
    const map = new Map<string, ParticipantRow>()
    for (const participant of participants ?? []) {
      map.set(participant.id, participant)
    }
    return map
  }, [participants])

  const calculationByScope = useMemo(() => {
    const map = new Map<string, ResultCalculationRow>()
    for (const calc of calculations ?? []) {
      map.set(scopeKey(calc.round_id, calc.segment_id), calc)
    }
    return map
  }, [calculations])

  const entriesByCalculation = useMemo(() => {
    const map = new Map<string, ResultCalculationEntryRow[]>()
    for (const entry of entries ?? []) {
      const list = map.get(entry.calculation_id) ?? []
      list.push(entry)
      map.set(entry.calculation_id, list)
    }
    return map
  }, [entries])

  async function handleCalculateRound(round: RoundRow) {
    if (!eventId || !segmentsByRound) return
    const segments = segmentsByRound[round.id] ?? []

    setActionError(null)
    setCalculatingRoundId(round.id)
    try {
      for (const segment of segments) {
        await calculateResults(eventId, round.id, segment.id)
      }
      await calculateResults(eventId, round.id, null)
      await reloadResults()
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to calculate results.'))
    } finally {
      setCalculatingRoundId(null)
    }
  }

  async function handleCalculateOverall() {
    if (!eventId) return

    setActionError(null)
    setCalculatingOverall(true)
    try {
      await calculateResults(eventId, null, null)
      await reloadResults()
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to calculate the overall results.'))
    } finally {
      setCalculatingOverall(false)
    }
  }

  if (loadError) {
    return (
      <PageShell>
        <PageInner>
          <BackLink to={`/events/${eventId}/rounds`}>Back to rounds</BackLink>
          <ErrorText role="alert">{loadError}</ErrorText>
        </PageInner>
      </PageShell>
    )
  }

  if (!event || !rounds || !segmentsByRound || !participants || !calculations || !entries) {
    return (
      <PageShell>
        <PageInner>
          <PageSubtitle>Loading…</PageSubtitle>
        </PageInner>
      </PageShell>
    )
  }

  const finalRound = rounds.find((round) => round.is_final_round) ?? null
  const overallCalc = calculationByScope.get(scopeKey(null, null))
  const overallEntries = overallCalc ? entriesByCalculation.get(overallCalc.id) ?? [] : []
  const overallReady = finalRound?.status === 'advanced'

  return (
    <PageShell>
      <PageInner>
        <PageHeader>
          <div>
            <PageTitle>Results — {event.name}</PageTitle>
            <PageSubtitle>
              Frozen, versioned leaderboards read from each scope's current calculation.
            </PageSubtitle>
          </div>
          <Row>
            <LinkButton to={`/events/${event.id}/results/history`} tone="secondary">
              View history
            </LinkButton>
            <BackLink to={`/events/${event.id}/rounds`}>Back to rounds</BackLink>
          </Row>
        </PageHeader>

        {actionError && <ErrorText role="alert">{actionError}</ErrorText>}

        {rounds.length === 0 && <EmptyState>No rounds configured yet.</EmptyState>}

        {rounds.map((round) => {
          const segments = segmentsByRound[round.id] ?? []
          const canCalculate = round.status === 'scoring_closed' || round.status === 'advanced'
          const roundCalc = calculationByScope.get(scopeKey(round.id, null))
          const roundEntries = roundCalc ? entriesByCalculation.get(roundCalc.id) ?? [] : []

          return (
            <RoundSection key={round.id}>
              <BoardHeader>
                {event.has_rounds ? (
                  <SectionTitle>
                    Round {round.sequence}: {round.name}
                  </SectionTitle>
                ) : (
                  <span />
                )}
                <Button
                  type="button"
                  tone="secondary"
                  disabled={!canCalculate || calculatingRoundId === round.id}
                  onClick={() => handleCalculateRound(round)}
                >
                  {calculatingRoundId === round.id ? 'Calculating…' : 'Calculate results'}
                </Button>
              </BoardHeader>

              {!canCalculate && (
                <HelpText>
                  Results can be calculated once this round's scoring is closed.
                </HelpText>
              )}

              {segments.map((segment) => {
                const segCalc = calculationByScope.get(scopeKey(round.id, segment.id))
                const segEntries = segCalc ? entriesByCalculation.get(segCalc.id) ?? [] : []
                return (
                  <ResultBoard
                    key={segment.id}
                    title={segment.name}
                    calculation={segCalc}
                    entries={segEntries}
                    participantsById={participantsById}
                  />
                )
              })}

              {event.has_rounds && (
                <ResultBoard
                  title="Round leaderboard"
                  calculation={roundCalc}
                  entries={roundEntries}
                  participantsById={participantsById}
                />
              )}

              {round.is_final_round && (
                <>
                  <BoardHeader>
                    <SectionTitle>Overall champion</SectionTitle>
                    <Button
                      type="button"
                      tone="primary"
                      disabled={!overallReady || calculatingOverall}
                      onClick={handleCalculateOverall}
                    >
                      {calculatingOverall ? 'Calculating…' : 'Calculate overall results'}
                    </Button>
                  </BoardHeader>
                  {!overallReady ? (
                    <HelpText>Available once the final round has advanced.</HelpText>
                  ) : (
                    <ResultBoard
                      title="Overall"
                      calculation={overallCalc}
                      entries={overallEntries}
                      participantsById={participantsById}
                    />
                  )}
                </>
              )}
            </RoundSection>
          )
        })}
      </PageInner>
    </PageShell>
  )
}
