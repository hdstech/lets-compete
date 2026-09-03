import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getDeadlineMs, formatClock } from '../../lib/quiz-timing'
import { ErrorText } from '../auth/auth-ui'
import { Button, LinkButton } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Title as PageTitle, Subtitle as PageSubtitle } from '../../components/ui/Typography'
import { declareWinner, getEvent, getErrorMessage as getEventErrorMessage } from '../events/events-api'
import {
  BackLink,
  Card,
  HelpText,
  PageHeader,
  PageInner,
  PageShell,
  Row,
  SectionTitle,
} from '../events/events-ui'
import type { EventRow } from '../events/types'
import { closeQuestionWindow, getErrorMessage as getLiveQuizErrorMessage } from '../live-quiz/live-quiz-api'
import { listEventParticipants } from '../participants/participants-api'
import type { ParticipantRow } from '../participants/types'
import { getQuestion } from '../questions/questions-api'
import type { QuestionRow } from '../questions/types'
import {
  advanceRound,
  getRound,
  getErrorMessage as getRoundErrorMessage,
} from '../rounds/rounds-api'
import type { RoundRow } from '../rounds/types'
import { listCalculationEntries, listFinalCalculations, scopeKey } from '../results/results-api'
import { BoardCell, BoardHeadCell, BoardTable, RankCell } from '../results/results-ui'
import type { ResultCalculationEntryRow, ResultCalculationRow } from '../results/types'
import {
  drawTiebreakQuestion,
  getErrorMessage as getTiebreakErrorMessage,
  listTiebreakEntrants,
  listTiebreakQuestions,
  listTiebreaksForRound,
  resolveTiebreakQuestion,
  startTiebreak,
  voidTiebreakQuestion,
} from '../tiebreaks/tiebreaks-api'
import type { TiebreakEntrantRow, TiebreakQuestionRow, TiebreakRow } from '../tiebreaks/types'
import { Countdown, DrawHistoryList, OutcomeBadge } from './advancement-ui'

type Outcome = 'advanced' | 'eliminated' | 'pending'

type LoadedState = {
  eventRow: EventRow
  roundRow: RoundRow
  participantRows: ParticipantRow[]
  calc: ResultCalculationRow | null
  entryRows: ResultCalculationEntryRow[]
  tiebreak: TiebreakRow | null
  entrantRows: TiebreakEntrantRow[]
  tbQuestionRows: TiebreakQuestionRow[]
  drawnQuestion: QuestionRow | null
}

async function loadAdvancementState(eventId: string, roundId: string): Promise<LoadedState> {
  const [eventRow, roundRow, participantRows] = await Promise.all([
    getEvent(eventId),
    getRound(roundId),
    listEventParticipants(eventId),
  ])

  const finalCalcs = await listFinalCalculations(eventId)
  const calc =
    finalCalcs.find((c) => scopeKey(c.round_id, c.segment_id) === scopeKey(roundId, null)) ?? null
  const entryRows = calc ? await listCalculationEntries([calc.id]) : []

  const tiebreaks = await listTiebreaksForRound(roundId)
  const tiebreak = calc ? tiebreaks.find((t) => t.calculation_id === calc.id) ?? null : null

  let entrantRows: TiebreakEntrantRow[] = []
  let tbQuestionRows: TiebreakQuestionRow[] = []
  let drawnQuestion: QuestionRow | null = null

  if (tiebreak) {
    ;[entrantRows, tbQuestionRows] = await Promise.all([
      listTiebreakEntrants(tiebreak.id),
      listTiebreakQuestions(tiebreak.id),
    ])
    const drawn = tbQuestionRows.find((q) => q.resolved_at === null)
    if (drawn) drawnQuestion = await getQuestion(drawn.question_id)
  }

  return { eventRow, roundRow, participantRows, calc, entryRows, tiebreak, entrantRows, tbQuestionRows, drawnQuestion }
}

export function AdvancementPage() {
  const { eventId, roundId } = useParams<{ eventId: string; roundId: string }>()

  const [event, setEvent] = useState<EventRow | null>(null)
  const [round, setRound] = useState<RoundRow | null>(null)
  const [participants, setParticipants] = useState<ParticipantRow[] | null>(null)
  const [roundCalc, setRoundCalc] = useState<ResultCalculationRow | null>(null)
  const [entries, setEntries] = useState<ResultCalculationEntryRow[]>([])
  const [tiebreak, setTiebreak] = useState<TiebreakRow | null>(null)
  const [entrants, setEntrants] = useState<TiebreakEntrantRow[]>([])
  const [tbQuestions, setTbQuestions] = useState<TiebreakQuestionRow[]>([])
  const [drawnQuestion, setDrawnQuestion] = useState<QuestionRow | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const [actionError, setActionError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [confirmingStart, setConfirmingStart] = useState(false)
  const [confirmingCommit, setConfirmingCommit] = useState(false)

  const [now, setNow] = useState(() => Date.now())
  const autoClosedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!eventId || !roundId) return

    let cancelled = false
    loadAdvancementState(eventId, roundId)
      .then((state) => {
        if (cancelled) return
        applyState(state)
        setLoaded(true)
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [eventId, roundId])

  function applyState(state: LoadedState) {
    setEvent(state.eventRow)
    setRound(state.roundRow)
    setParticipants(state.participantRows)
    setRoundCalc(state.calc)
    setEntries(state.entryRows)
    setTiebreak(state.tiebreak)
    setEntrants(state.entrantRows)
    setTbQuestions(state.tbQuestionRows)
    setDrawnQuestion(state.drawnQuestion)
  }

  async function reload() {
    if (!eventId || !roundId) return
    const state = await loadAdvancementState(eventId, roundId)
    applyState(state)
  }

  // Tick the clock once a second to drive the drawn tiebreak question's
  // countdown, same as the live console does for a round's own questions.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const deadlineMs =
    drawnQuestion && drawnQuestion.status === 'window_open' ? getDeadlineMs(drawnQuestion) : null
  const remainingMs = deadlineMs !== null ? deadlineMs - now : null

  // Server-authoritative: the DB stops accepting answers at the deadline
  // regardless of this call — it only drives the drawn question's status
  // forward once the window has genuinely elapsed, the same auto-close the
  // live console does for a round's own questions (nothing else watches a
  // tiebreak question once the round has left scoring_open).
  useEffect(() => {
    if (!drawnQuestion || remainingMs === null || remainingMs > 0) return
    if (autoClosedRef.current.has(drawnQuestion.id)) return
    autoClosedRef.current.add(drawnQuestion.id)

    closeQuestionWindow(drawnQuestion.id)
      .then(() => reload())
      .catch((err: unknown) => {
        autoClosedRef.current.delete(drawnQuestion.id)
        setActionError(getLiveQuizErrorMessage(err, 'Failed to close the tiebreak question window'))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawnQuestion, remainingMs])

  const participantsById = useMemo(() => {
    const map = new Map<string, ParticipantRow>()
    for (const participant of participants ?? []) {
      map.set(participant.id, participant)
    }
    return map
  }, [participants])

  const entrantOutcomeByParticipant = useMemo(() => {
    const map = new Map<string, TiebreakEntrantRow['outcome']>()
    for (const entrant of entrants) {
      map.set(entrant.participant_id, entrant.outcome)
    }
    return map
  }, [entrants])

  const cutoff = round ? (round.is_final_round ? 1 : (round.advancement_n as number)) : null
  const tiedAtCutoff = cutoff !== null ? entries.filter((e) => e.rank === cutoff) : []
  const hasTie = tiedAtCutoff.length >= 2
  const committed = round
    ? round.is_final_round
      ? event?.winner_participant_id != null
      : round.status === 'advanced'
    : false

  function outcomeForEntry(entry: ResultCalculationEntryRow): Outcome {
    if (cutoff === null) return 'pending'
    if (entry.rank < cutoff) return 'advanced'
    if (entry.rank > cutoff) return 'eliminated'
    if (!hasTie) return 'advanced'
    if (!tiebreak) return 'pending'
    if (tiebreak.status === 'resolved') {
      return entrantOutcomeByParticipant.get(entry.participant_id) === 'advanced' ? 'advanced' : 'eliminated'
    }
    if (tiebreak.status === 'exhausted') {
      // Advance-scope falls back to the standard co-advance rule once the
      // reserve pool is exhausted; winner-scope has no such fallback (V1 has
      // no co-champion representation), so it stays pending/blocked.
      return round?.is_final_round ? 'pending' : 'advanced'
    }
    return 'pending'
  }

  const tieUnresolved = hasTie && (!tiebreak || tiebreak.status === 'open')
  const finalExhaustedBlocked = Boolean(round?.is_final_round && tiebreak?.status === 'exhausted')
  const canCommit = Boolean(roundCalc) && !committed && !tieUnresolved && !finalExhaustedBlocked
  const canStartTiebreak = hasTie && !tiebreak && !committed
  const drawnTbQuestion = tbQuestions.find((q) => q.resolved_at === null) ?? null
  const canDraw = Boolean(tiebreak) && tiebreak?.status === 'open' && !drawnTbQuestion && !committed
  const canVoid = Boolean(tiebreak) && tiebreak?.status === 'open' && Boolean(drawnTbQuestion) && !committed
  const canResolve =
    canVoid &&
    drawnQuestion !== null &&
    (drawnQuestion.status === 'window_closed' || drawnQuestion.status === 'voided')

  async function handleStartTiebreak() {
    if (!round) return
    setConfirmingStart(false)
    setActionError(null)
    setStarting(true)
    try {
      await startTiebreak(round.id)
      await reload()
    } catch (err) {
      setActionError(getTiebreakErrorMessage(err, 'Failed to start the tiebreak.'))
    } finally {
      setStarting(false)
    }
  }

  async function handleDraw() {
    if (!tiebreak) return
    setActionError(null)
    setDrawing(true)
    try {
      await drawTiebreakQuestion(tiebreak.id)
      await reload()
    } catch (err) {
      setActionError(getTiebreakErrorMessage(err, 'Failed to draw the next tiebreak question.'))
    } finally {
      setDrawing(false)
    }
  }

  async function handleVoid() {
    if (!tiebreak) return
    setActionError(null)
    setVoiding(true)
    try {
      await voidTiebreakQuestion(tiebreak.id)
      await reload()
    } catch (err) {
      setActionError(getTiebreakErrorMessage(err, 'Failed to void the tiebreak question.'))
    } finally {
      setVoiding(false)
    }
  }

  async function handleResolve() {
    if (!tiebreak) return
    setActionError(null)
    setResolving(true)
    try {
      await resolveTiebreakQuestion(tiebreak.id)
      await reload()
    } catch (err) {
      setActionError(getTiebreakErrorMessage(err, 'Failed to resolve the tiebreak question.'))
    } finally {
      setResolving(false)
    }
  }

  async function handleCommit() {
    if (!round || !eventId) return
    setConfirmingCommit(false)
    setActionError(null)
    setCommitting(true)
    try {
      if (round.is_final_round) {
        await declareWinner(eventId)
      } else {
        await advanceRound(round.id)
      }
      await reload()
    } catch (err) {
      const fallback = round.is_final_round
        ? 'Failed to declare the winner.'
        : 'Failed to advance the round.'
      setActionError(
        round.is_final_round
          ? getEventErrorMessage(err, fallback)
          : getRoundErrorMessage(err, fallback),
      )
    } finally {
      setCommitting(false)
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

  if (!loaded || !event || !round) {
    return (
      <PageShell>
        <PageInner>
          <PageSubtitle>Loading…</PageSubtitle>
        </PageInner>
      </PageShell>
    )
  }

  const notReady = round.status === 'pending' || round.status === 'scoring_open'
  const champion = event.winner_participant_id
    ? participantsById.get(event.winner_participant_id)
    : null

  return (
    <PageShell>
      <PageInner>
        <PageHeader>
          <div>
            <PageTitle>
              Advancement — Round {round.sequence}: {round.name}
            </PageTitle>
            <PageSubtitle>{event.name}</PageSubtitle>
          </div>
          <BackLink to={`/events/${eventId}/rounds`}>Back to rounds</BackLink>
        </PageHeader>

        {notReady ? (
          <HelpText>
            This round hasn't closed for scoring yet. Advancement review opens once the round is
            closed and its results are calculated.
          </HelpText>
        ) : !roundCalc ? (
          <Card>
            <SectionTitle>Results not calculated yet</SectionTitle>
            <HelpText>Calculate this round's results before reviewing advancement.</HelpText>
            <Row>
              <LinkButton to={`/events/${eventId}/results`} tone="secondary">
                Go to results
              </LinkButton>
            </Row>
          </Card>
        ) : (
          <>
            {actionError && <ErrorText role="alert">{actionError}</ErrorText>}

            {champion && (
              <Card>
                <SectionTitle>Champion declared</SectionTitle>
                <HelpText>{champion.name} has been declared the winner of this event.</HelpText>
              </Card>
            )}

            <Card>
              <SectionTitle>
                {round.is_final_round ? `Rank 1 wins` : `Top ${round.advancement_n} advance`}
              </SectionTitle>
              {entries.length === 0 ? (
                <HelpText>No eligible participants scored in this round.</HelpText>
              ) : (
                <BoardTable>
                  <thead>
                    <tr>
                      <BoardHeadCell scope="col">Rank</BoardHeadCell>
                      <BoardHeadCell scope="col">Participant</BoardHeadCell>
                      <BoardHeadCell scope="col">Score</BoardHeadCell>
                      <BoardHeadCell scope="col">Outcome</BoardHeadCell>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const outcome = outcomeForEntry(entry)
                      return (
                        <tr key={entry.id}>
                          <RankCell>{entry.rank}</RankCell>
                          <BoardCell>
                            {participantsById.get(entry.participant_id)?.name ?? 'Unknown participant'}
                          </BoardCell>
                          <BoardCell>{entry.total_score}</BoardCell>
                          <BoardCell>
                            <OutcomeBadge outcome={outcome}>{outcome}</OutcomeBadge>
                          </BoardCell>
                        </tr>
                      )
                    })}
                  </tbody>
                </BoardTable>
              )}
            </Card>

            {hasTie && (
              <Card>
                <SectionTitle>Tiebreak</SectionTitle>

                {canStartTiebreak && (
                  <>
                    <HelpText>
                      {tiedAtCutoff.length} participants are tied at rank {cutoff}. Start a
                      sudden-death tiebreak to narrow it, or commit below to let the tie co-advance
                      the whole cohort.
                    </HelpText>
                    <Row>
                      <Button
                        type="button"
                        tone="primary"
                        onClick={() => setConfirmingStart(true)}
                        disabled={starting}
                      >
                        {starting ? 'Starting…' : 'Start tiebreak'}
                      </Button>
                    </Row>
                  </>
                )}

                {tiebreak && (
                  <>
                    <HelpText>
                      {tiebreak.status === 'open' && 'Sudden death in progress — one question at a time.'}
                      {tiebreak.status === 'resolved' && 'Resolved — outcomes above reflect the tiebreak.'}
                      {tiebreak.status === 'exhausted' &&
                        (round.is_final_round
                          ? 'The reserve pool was exhausted with the tie unresolved. V1 has no co-champion representation — resolve this outside the app before declaring a winner.'
                          : 'The reserve pool was exhausted; the tied cohort co-advances by the standard rule.')}
                    </HelpText>

                    {tbQuestions.length > 0 && (
                      <DrawHistoryList>
                        {tbQuestions.map((q, i) => (
                          <li key={q.id}>
                            Question {i + 1}:{' '}
                            {q.resolved_at === null
                              ? 'awaiting grading/resolution'
                              : q.broke_tie === null
                                ? 'voided'
                                : q.broke_tie
                                  ? 'broke the tie'
                                  : 'still tied — another question was drawn'}
                          </li>
                        ))}
                      </DrawHistoryList>
                    )}

                    {drawnQuestion && (
                      <>
                        <HelpText>Current question: {drawnQuestion.prompt}</HelpText>
                        {drawnQuestion.status === 'window_open' && (
                          <Countdown aria-live="polite">{formatClock(remainingMs ?? 0)}</Countdown>
                        )}
                      </>
                    )}

                    <Row>
                      {canDraw && (
                        <Button type="button" tone="primary" onClick={handleDraw} disabled={drawing}>
                          {drawing ? 'Drawing…' : 'Draw next question'}
                        </Button>
                      )}
                      {canVoid && (
                        <>
                          <LinkButton
                            to={`/events/${eventId}/rounds/${roundId}/grade`}
                            tone="secondary"
                          >
                            Grade this question
                          </LinkButton>
                          <Button
                            type="button"
                            tone="primary"
                            onClick={handleResolve}
                            disabled={!canResolve || resolving}
                          >
                            {resolving ? 'Resolving…' : 'Resolve question'}
                          </Button>
                          <Button type="button" tone="danger" onClick={handleVoid} disabled={voiding}>
                            {voiding ? 'Voiding…' : 'Void question'}
                          </Button>
                        </>
                      )}
                    </Row>
                  </>
                )}
              </Card>
            )}

            {committed ? (
              <HelpText>
                {round.is_final_round
                  ? 'The winner has been declared for this event.'
                  : 'This round has already advanced.'}
              </HelpText>
            ) : (
              <Card>
                <SectionTitle>Commit</SectionTitle>
                {tieUnresolved && (
                  <HelpText>Resolve or exhaust the tiebreak above before committing.</HelpText>
                )}
                {finalExhaustedBlocked && (
                  <HelpText>
                    Declaring a winner is blocked until the rank-1 tie is resolved outside the app.
                  </HelpText>
                )}
                <Row>
                  <Button
                    type="button"
                    tone="success"
                    onClick={() => setConfirmingCommit(true)}
                    disabled={!canCommit || committing}
                  >
                    {committing
                      ? round.is_final_round
                        ? 'Declaring winner…'
                        : 'Advancing…'
                      : round.is_final_round
                        ? 'Declare winner'
                        : 'Advance round'}
                  </Button>
                </Row>
              </Card>
            )}
          </>
        )}
      </PageInner>

      <ConfirmDialog
        open={confirmingStart}
        title="Start tiebreak"
        description={`Start a sudden-death tiebreak for the ${tiedAtCutoff.length}-way tie at rank ${cutoff ?? ''}?`}
        confirmLabel="Start tiebreak"
        tone="primary"
        onConfirm={handleStartTiebreak}
        onCancel={() => setConfirmingStart(false)}
      />

      <ConfirmDialog
        open={confirmingCommit}
        title={round.is_final_round ? 'Declare winner' : 'Advance round'}
        description={
          round.is_final_round
            ? 'Declare the champion for this event? This locks in the final rank.'
            : `Advance round ${round.sequence} and open the next round?`
        }
        confirmLabel={round.is_final_round ? 'Declare winner' : 'Advance round'}
        tone="primary"
        onConfirm={handleCommit}
        onCancel={() => setConfirmingCommit(false)}
      />
    </PageShell>
  )
}
