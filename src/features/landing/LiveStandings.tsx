import { useEffect, useMemo, useState } from 'react'
import {
  LiveDot,
  LiveLabel,
  RankBadge,
  StandingRow,
  StandingsCard,
  StandingsHeader,
  StandingsList,
  TeamName,
  TeamScore,
} from './landing-ui'
import { usePrefersReducedMotion } from './use-prefers-reduced-motion'

type Standing = {
  id: string
  name: string
  score: number
}

const ROW_HEIGHT = 44
const ROW_GAP = 8
const TICK_MS = 2200
// Once anyone reaches this the demo restarts, so the numbers stay three
// digits however long the page is left open on a display screen.
const ROUND_TARGET = 400

const OPENING_STANDINGS: Standing[] = [
  { id: 'quizzly-bears', name: 'Quizzly Bears', score: 180 },
  { id: 'team-nova', name: 'Team Nova', score: 165 },
  { id: 'mic-drop', name: 'Mic Drop', score: 150 },
  { id: 'the-underdogs', name: 'The Underdogs', score: 140 },
]

function awardPoints(standings: Standing[]): Standing[] {
  const scorer = Math.floor(Math.random() * standings.length)
  const points = 10 + Math.floor(Math.random() * 5) * 5

  const next = standings.map((team, index) =>
    index === scorer ? { ...team, score: team.score + points } : team,
  )

  return next.some((team) => team.score >= ROUND_TARGET) ? OPENING_STANDINGS : next
}

// The one moving picture of the product: a leaderboard that reshuffles itself
// as points land. It is a simulation rather than real data, so it is hidden
// from assistive tech — the copy beside it carries the same message.
export function LiveStandings() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [standings, setStandings] = useState(OPENING_STANDINGS)

  useEffect(() => {
    if (prefersReducedMotion) return

    const timer = setInterval(() => setStandings(awardPoints), TICK_MS)
    return () => clearInterval(timer)
  }, [prefersReducedMotion])

  // Rows keep their DOM position and slide to their rank, so a team that
  // overtakes another visibly moves past it instead of blinking into place.
  const ranks = useMemo(() => {
    const ordered = [...standings].sort(
      (a, b) => b.score - a.score || a.id.localeCompare(b.id),
    )
    return new Map(ordered.map((team, index) => [team.id, index]))
  }, [standings])

  const listHeight = standings.length * (ROW_HEIGHT + ROW_GAP) - ROW_GAP

  return (
    <StandingsCard aria-hidden="true">
      <StandingsHeader>
        <LiveLabel>
          <LiveDot />
          Live standings
        </LiveLabel>
        <span>Round 2 · Music</span>
      </StandingsHeader>
      <StandingsList style={{ height: listHeight }}>
        {standings.map((team) => {
          const rank = ranks.get(team.id) ?? 0
          return (
            <StandingRow
              key={team.id}
              leading={rank === 0}
              style={{
                height: ROW_HEIGHT,
                transform: `translateY(${rank * (ROW_HEIGHT + ROW_GAP)}px)`,
              }}
            >
              <RankBadge leading={rank === 0}>{rank + 1}</RankBadge>
              <TeamName>{team.name}</TeamName>
              <TeamScore>{team.score}</TeamScore>
            </StandingRow>
          )
        })}
      </StandingsList>
    </StandingsCard>
  )
}
