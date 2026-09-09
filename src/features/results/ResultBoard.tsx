import {
  HelpText,
  SectionTitle,
} from '../events/events-ui'
import { Card } from '../../components/ui/Card'
import type { ParticipantRow } from '../participants/types'
import {
  BoardCell,
  BoardHeader,
  BoardHeadCell,
  BoardMeta,
  BoardRow,
  BoardTable,
  RankCell,
  RankTile,
} from './results-ui'
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
              <BoardHeadCell scope="col" numeric>
                Score
              </BoardHeadCell>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <BoardRow key={entry.id} leading={entry.rank === 1}>
                <RankCell>
                  <RankTile leading={entry.rank === 1}>{entry.rank}</RankTile>
                </RankCell>
                <BoardCell>
                  {participantsById.get(entry.participant_id)?.name ?? 'Unknown participant'}
                </BoardCell>
                <BoardCell numeric>{entry.total_score}</BoardCell>
              </BoardRow>
            ))}
          </tbody>
        </BoardTable>
      )}
    </Card>
  )
}
