import { Card, HelpText, SectionTitle } from '../events/events-ui'
import type { ParticipantRow } from '../participants/types'
import { BoardCell, BoardHeader, BoardHeadCell, BoardMeta, BoardTable, RankCell } from './results-ui'
import type { ResultCalculationEntryRow, ResultCalculationRow } from './types'

export function ResultBoard({
  title,
  calculation,
  entries,
  participantsById,
}: {
  title: string
  calculation: ResultCalculationRow | undefined
  entries: ResultCalculationEntryRow[]
  participantsById: Map<string, ParticipantRow>
}) {
  return (
    <Card>
      <BoardHeader>
        <SectionTitle>{title}</SectionTitle>
        {calculation && (
          <BoardMeta>
            Current · calculated {new Date(calculation.calculated_at).toLocaleString()}
          </BoardMeta>
        )}
      </BoardHeader>
      {!calculation ? (
        <HelpText>Not yet calculated.</HelpText>
      ) : entries.length === 0 ? (
        <HelpText>No eligible participants scored in this scope.</HelpText>
      ) : (
        <BoardTable>
          <thead>
            <tr>
              <BoardHeadCell scope="col">Rank</BoardHeadCell>
              <BoardHeadCell scope="col">Participant</BoardHeadCell>
              <BoardHeadCell scope="col">Score</BoardHeadCell>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <RankCell>{entry.rank}</RankCell>
                <BoardCell>
                  {participantsById.get(entry.participant_id)?.name ?? 'Unknown participant'}
                </BoardCell>
                <BoardCell>{entry.total_score}</BoardCell>
              </tr>
            ))}
          </tbody>
        </BoardTable>
      )}
    </Card>
  )
}
