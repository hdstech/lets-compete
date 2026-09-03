import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'
import { ErrorText } from '../auth/auth-ui'
import {
  Title as PageTitle,
  Subtitle as PageSubtitle,
} from '../../components/ui/Typography'
import { getEvent } from '../events/events-api'
import {
  BackLink,
  Card,
  EmptyState,
  HelpText,
  PageHeader,
  PageInner,
  PageShell,
  SectionTitle,
} from '../events/events-ui'
import type { EventRow } from '../events/types'
import { listEventParticipants } from '../participants/participants-api'
import type { ParticipantRow } from '../participants/types'
import { listRounds } from '../rounds/rounds-api'
import type { RoundRow } from '../rounds/types'
import { listSegments } from '../segments/segments-api'
import type { SegmentRow } from '../segments/types'
import { listAllCalculations, listCalculationEntries, scopeKey } from './results-api'
import { BoardCell, BoardHeadCell, BoardHeader, BoardTable, RankCell } from './results-ui'
import type { ResultCalculationEntryRow, ResultCalculationRow } from './types'

const StatusBadge = styled('span', {
  base: {
    fontSize: 'xs',
    fontWeight: 'semibold',
    borderRadius: 'full',
    px: '2.5',
    py: '1',
  },
  variants: {
    isFinal: {
      true: { bg: 'green.700', color: 'green.50' },
      false: { bg: 'bg.sunken', color: 'text.muted' },
    },
  },
})

const RunRow = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '3',
    flexWrap: 'wrap',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'control',
    px: '3',
    py: '2.5',
    bg: 'bg.surface',
    cursor: 'pointer',
  },
})

const RunMeta = styled('div', {
  base: { display: 'flex', flexDirection: 'column', gap: '0.5' },
})

const RunTimestamp = styled('span', {
  base: { fontSize: 'sm', color: 'text.primary' },
})

const RunReason = styled('span', {
  base: { fontSize: 'xs', color: 'text.muted' },
})

const RunList = styled('div', {
  base: { display: 'flex', flexDirection: 'column', gap: '2' },
})

function scopeLabel(
  roundId: string | null,
  segmentId: string | null,
  roundsById: Map<string, RoundRow>,
  segmentsById: Map<string, SegmentRow>,
): string {
  if (roundId === null) return 'Overall'
  if (segmentId !== null) {
    return segmentsById.get(segmentId)?.name ?? 'Unknown segment'
  }
  const round = roundsById.get(roundId)
  return round ? `Round ${round.sequence}: ${round.name} — round leaderboard` : 'Round leaderboard'
}

function CalculationRun({
  calculation,
  entries,
  expanded,
  onToggle,
  participantsById,
}: {
  calculation: ResultCalculationRow
  entries: ResultCalculationEntryRow[] | undefined
  expanded: boolean
  onToggle: () => void
  participantsById: Map<string, ParticipantRow>
}) {
  return (
    <div>
      <RunRow onClick={onToggle} role="button" aria-expanded={expanded}>
        <RunMeta>
          <RunTimestamp>{new Date(calculation.calculated_at).toLocaleString()}</RunTimestamp>
          <RunReason>{calculation.reason ?? 'No reason given'}</RunReason>
        </RunMeta>
        <StatusBadge isFinal={calculation.is_final}>
          {calculation.is_final ? 'Current' : 'Superseded'}
        </StatusBadge>
      </RunRow>
      {expanded && (
        <BoardTable>
          <thead>
            <tr>
              <BoardHeadCell scope="col">Rank</BoardHeadCell>
              <BoardHeadCell scope="col">Participant</BoardHeadCell>
              <BoardHeadCell scope="col">Score</BoardHeadCell>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).length === 0 ? (
              <tr>
                <BoardCell colSpan={3}>No eligible participants scored in this run.</BoardCell>
              </tr>
            ) : (
              (entries ?? []).map((entry) => (
                <tr key={entry.id}>
                  <RankCell>{entry.rank}</RankCell>
                  <BoardCell>
                    {participantsById.get(entry.participant_id)?.name ?? 'Unknown participant'}
                  </BoardCell>
                  <BoardCell>{entry.total_score}</BoardCell>
                </tr>
              ))
            )}
          </tbody>
        </BoardTable>
      )}
    </div>
  )
}

export function ResultsHistoryPage() {
  const { eventId } = useParams<{ eventId: string }>()

  const [event, setEvent] = useState<EventRow | null>(null)
  const [rounds, setRounds] = useState<RoundRow[] | null>(null)
  const [segments, setSegments] = useState<SegmentRow[] | null>(null)
  const [participants, setParticipants] = useState<ParticipantRow[] | null>(null)
  const [calculations, setCalculations] = useState<ResultCalculationRow[] | null>(null)
  const [entriesByCalculation, setEntriesByCalculation] = useState<
    Map<string, ResultCalculationEntryRow[]>
  >(new Map())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [expandedCalcId, setExpandedCalcId] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId) return

    let cancelled = false
    Promise.all([getEvent(eventId), listRounds(eventId), listEventParticipants(eventId)])
      .then(async ([eventRow, roundRows, participantRows]) => {
        if (cancelled) return
        const [segmentLists, calcRows] = await Promise.all([
          Promise.all(roundRows.map((round) => listSegments(round.id))),
          listAllCalculations(eventId),
        ])
        const entryRows = await listCalculationEntries(calcRows.map((calc) => calc.id))
        if (cancelled) return

        const entryMap = new Map<string, ResultCalculationEntryRow[]>()
        for (const entry of entryRows) {
          const list = entryMap.get(entry.calculation_id) ?? []
          list.push(entry)
          entryMap.set(entry.calculation_id, list)
        }

        setEvent(eventRow)
        setRounds(roundRows)
        setSegments(segmentLists.flat())
        setParticipants(participantRows)
        setCalculations(calcRows)
        setEntriesByCalculation(entryMap)
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [eventId])

  const participantsById = useMemo(() => {
    const map = new Map<string, ParticipantRow>()
    for (const participant of participants ?? []) {
      map.set(participant.id, participant)
    }
    return map
  }, [participants])

  const roundsById = useMemo(() => {
    const map = new Map<string, RoundRow>()
    for (const round of rounds ?? []) {
      map.set(round.id, round)
    }
    return map
  }, [rounds])

  const segmentsById = useMemo(() => {
    const map = new Map<string, SegmentRow>()
    for (const segment of segments ?? []) {
      map.set(segment.id, segment)
    }
    return map
  }, [segments])

  const scopeGroups = useMemo(() => {
    const groups = new Map<string, { label: string; runs: ResultCalculationRow[] }>()
    for (const calc of calculations ?? []) {
      const key = scopeKey(calc.round_id, calc.segment_id)
      const group = groups.get(key)
      if (group) {
        group.runs.push(calc)
      } else {
        groups.set(key, {
          label: scopeLabel(calc.round_id, calc.segment_id, roundsById, segmentsById),
          runs: [calc],
        })
      }
    }
    // Newest run first within each scope; calculations were already fetched
    // ordered by calculated_at desc, so insertion order already matches.
    return Array.from(groups.values())
  }, [calculations, roundsById, segmentsById])

  if (loadError) {
    return (
      <PageShell>
        <PageInner>
          <BackLink to={`/events/${eventId}/results`}>Back to results</BackLink>
          <ErrorText role="alert">{loadError}</ErrorText>
        </PageInner>
      </PageShell>
    )
  }

  if (!event || !calculations) {
    return (
      <PageShell>
        <PageInner>
          <PageSubtitle>Loading…</PageSubtitle>
        </PageInner>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageInner>
        <PageHeader>
          <div>
            <PageTitle>Calculation history — {event.name}</PageTitle>
            <PageSubtitle>
              Every calculate_results run for this event, including superseded ones.
            </PageSubtitle>
          </div>
          <BackLink to={`/events/${eventId}/results`}>Back to results</BackLink>
        </PageHeader>

        {scopeGroups.length === 0 && (
          <EmptyState>No results have been calculated for this event yet.</EmptyState>
        )}

        {scopeGroups.map((group) => (
          <Card key={group.label}>
            <BoardHeader>
              <SectionTitle>{group.label}</SectionTitle>
              <HelpText>
                {group.runs.length} run{group.runs.length === 1 ? '' : 's'}
              </HelpText>
            </BoardHeader>
            <RunList>
              {group.runs.map((calc) => (
                <CalculationRun
                  key={calc.id}
                  calculation={calc}
                  entries={entriesByCalculation.get(calc.id)}
                  expanded={expandedCalcId === calc.id}
                  onToggle={() =>
                    setExpandedCalcId((current) => (current === calc.id ? null : calc.id))
                  }
                  participantsById={participantsById}
                />
              ))}
            </RunList>
          </Card>
        ))}
      </PageInner>
    </PageShell>
  )
}
