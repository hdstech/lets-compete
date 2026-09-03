import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'
import { supabase } from '../../lib/supabase'
import { getDeadlineMs, formatClock } from '../../lib/quiz-timing'
import { ErrorText } from '../auth/auth-ui'
import { Button, LinkButton } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import {
  Title as PageTitle,
  Subtitle as PageSubtitle,
} from '../../components/ui/Typography'
import { getEvent } from '../events/events-api'
import {
  BackLink,
  Card,
  DefinitionGrid,
  DefinitionTerm,
  DefinitionValue,
  EmptyState,
  HelpText,
  PageHeader,
  PageInner,
  PageShell,
  Row,
  SectionTitle,
} from '../events/events-ui'
import type { EventRow } from '../events/types'
import type { QuestionRow } from '../questions/types'
import { getRound } from '../rounds/rounds-api'
import type { RoundRow } from '../rounds/types'
import {
  autoMarkQuestionAnswers,
  closeQuestionWindow,
  closeRound,
  getErrorMessage,
  listActiveRoundParticipants,
  listAnswersForQuestions,
  listIntegrityEventsForQuestions,
  listRoundQuestions,
  revealQuestion,
  voidQuestion,
} from './live-quiz-api'
import type { RoundQuestion } from './live-quiz-api'
import type { AnswerRow, IntegrityEventRow, RoundParticipantRow } from './types'

const QuestionPrompt = styled('p', {
  base: { fontSize: 'lg', fontWeight: 'semibold', color: 'text.primary' },
})

const Countdown = styled('div', {
  base: {
    fontSize: '3xl',
    fontWeight: 'bold',
    fontVariantNumeric: 'tabular-nums',
    color: 'text.primary',
  },
})

const RosterGrid = styled('div', {
  base: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '2',
  },
})

const RosterItem = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '2',
    fontSize: 'sm',
    borderRadius: 'control',
    px: '2.5',
    py: '1.5',
  },
  variants: {
    answered: {
      yes: { bg: 'green.700', color: 'green.50' },
      no: { bg: 'bg.sunken', color: 'text.muted' },
    },
  },
})

export function LiveConsolePage() {
  const { eventId, roundId } = useParams<{ eventId: string; roundId: string }>()

  const [event, setEvent] = useState<EventRow | null>(null)
  const [round, setRound] = useState<RoundRow | null>(null)
  const [questions, setQuestions] = useState<RoundQuestion[] | null>(null)
  const [roster, setRoster] = useState<RoundParticipantRow[] | null>(null)
  const [answers, setAnswers] = useState<AnswerRow[]>([])
  const [integrityEvents, setIntegrityEvents] = useState<IntegrityEventRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [actionError, setActionError] = useState<string | null>(null)
  const [revealingId, setRevealingId] = useState<string | null>(null)
  const [questionPendingVoid, setQuestionPendingVoid] = useState<RoundQuestion | null>(null)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [closingRound, setClosingRound] = useState(false)
  const [confirmingCloseRound, setConfirmingCloseRound] = useState(false)

  const [now, setNow] = useState(() => Date.now())

  const autoClosedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!eventId || !roundId) return

    let cancelled = false
    Promise.all([
      getEvent(eventId),
      getRound(roundId),
      listRoundQuestions(roundId),
      listActiveRoundParticipants(roundId),
    ])
      .then(async ([eventRow, roundRow, questionRows, rosterRows]) => {
        if (cancelled) return
        const questionIds = questionRows.map((q) => q.id)
        const [answerRows, integrityRows] = await Promise.all([
          listAnswersForQuestions(questionIds),
          listIntegrityEventsForQuestions(questionIds),
        ])
        if (cancelled) return
        setEvent(eventRow)
        setRound(roundRow)
        setQuestions(questionRows)
        setRoster(rosterRows)
        setAnswers(answerRows)
        setIntegrityEvents(integrityRows)
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [eventId, roundId])

  const refreshAnswers = useCallback(async () => {
    if (!questions) return
    const questionIds = questions.map((q) => q.id)
    const [answerRows, integrityRows] = await Promise.all([
      listAnswersForQuestions(questionIds),
      listIntegrityEventsForQuestions(questionIds),
    ])
    setAnswers(answerRows)
    setIntegrityEvents(integrityRows)
  }, [questions])

  const refreshQuestions = useCallback(async () => {
    if (!roundId) return
    const rows = await listRoundQuestions(roundId)
    setQuestions(rows)
  }, [roundId])

  const questionIdsKey = useMemo(
    () => (questions ? questions.map((q) => q.id).join(',') : ''),
    [questions],
  )

  // Realtime: question status flips (reveal/close/void) reach every
  // subscriber via Postgres Changes (QA5), filtered by the questions_select
  // RLS policy. This is the frontend's first realtime consumer, and Postgres
  // Changes filters only support a single indexed-column eq — segment_id
  // can't express "any segment in this round" — so we subscribe unfiltered
  // and check membership client-side instead.
  useEffect(() => {
    if (!questionIdsKey) return
    const idSet = new Set(questionIdsKey.split(','))

    const channel = supabase
      .channel(`live-console-questions-${roundId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'questions' },
        (payload) => {
          const updated = payload.new as QuestionRow
          if (!idSet.has(updated.id)) return
          setQuestions((prev) =>
            prev ? prev.map((q) => (q.id === updated.id ? { ...q, ...updated } : q)) : prev,
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roundId, questionIdsKey])

  // Realtime: who's-answered updates as participants submit — round_id is a
  // real (denormalized) column on answers, so this can filter server-side.
  useEffect(() => {
    if (!roundId) return

    const channel = supabase
      .channel(`live-console-answers-${roundId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'answers', filter: `round_id=eq.${roundId}` },
        () => {
          refreshAnswers().catch(() => {
            // Best-effort: the next reveal/void/close-round action re-syncs.
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roundId, refreshAnswers])

  // Tick the clock once a second to drive the open question's countdown.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const openQuestion = useMemo(
    () => questions?.find((q) => q.status === 'window_open') ?? null,
    [questions],
  )

  const deadlineMs = useMemo(
    () => (openQuestion ? getDeadlineMs(openQuestion) : null),
    [openQuestion],
  )

  const remainingMs = deadlineMs !== null ? deadlineMs - now : null

  // Server-authoritative: the DB stops accepting answers at the deadline
  // regardless of this call (private.question_is_window_open, QA5). Calling
  // close_question_window here only drives the UI's own status/timestamp
  // forward once the window has genuinely elapsed — it re-checks the same
  // deadline server-side and rejects an early call.
  useEffect(() => {
    if (!openQuestion || remainingMs === null || remainingMs > 0) return
    if (autoClosedRef.current.has(openQuestion.id)) return
    autoClosedRef.current.add(openQuestion.id)

    closeQuestionWindow(openQuestion.id)
      .then(() => refreshQuestions())
      .catch((err: unknown) => {
        autoClosedRef.current.delete(openQuestion.id)
        setActionError(getErrorMessage(err, 'Failed to close the question window'))
      })
  }, [openQuestion, remainingMs, refreshQuestions])

  const nextPendingQuestion = useMemo(
    () => (openQuestion ? null : (questions?.find((q) => q.status === 'pending') ?? null)),
    [questions, openQuestion],
  )

  const allQuestionsDone = useMemo(
    () =>
      questions !== null &&
      questions.length > 0 &&
      questions.every((q) => q.status === 'window_closed' || q.status === 'voided'),
    [questions],
  )

  const focusedQuestion = useMemo(() => {
    if (openQuestion) return openQuestion
    const revealed = questions?.filter((q) => q.status !== 'pending')
    return revealed && revealed.length > 0 ? revealed[revealed.length - 1] : null
  }, [openQuestion, questions])

  const answeredParticipantIds = useMemo(() => {
    if (!focusedQuestion) return new Set<string>()
    return new Set(
      answers
        .filter((a) => a.question_id === focusedQuestion.id && a.submitted_at)
        .map((a) => a.participant_id),
    )
  }, [answers, focusedQuestion])

  const integrityCountByQuestion = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const integrityEvent of integrityEvents) {
      if (!integrityEvent.question_id) continue
      counts[integrityEvent.question_id] = (counts[integrityEvent.question_id] ?? 0) + 1
    }
    return counts
  }, [integrityEvents])

  async function handleReveal(questionId: string) {
    setActionError(null)
    setRevealingId(questionId)
    try {
      await revealQuestion(questionId)
      await refreshQuestions()
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to reveal question'))
    } finally {
      setRevealingId(null)
    }
  }

  async function confirmVoid() {
    if (!questionPendingVoid) return
    const question = questionPendingVoid
    setQuestionPendingVoid(null)

    setActionError(null)
    setVoidingId(question.id)
    try {
      await voidQuestion(question.id)
      await Promise.all([refreshQuestions(), refreshAnswers()])
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to void question'))
    } finally {
      setVoidingId(null)
    }
  }

  async function confirmCloseRound() {
    if (!roundId || !questions) return
    setConfirmingCloseRound(false)
    setActionError(null)
    setClosingRound(true)
    try {
      // Auto pre-mark every closed question before locking the round for
      // grading (QA7) — best-effort: a question whose 10s post-close grace
      // hasn't elapsed yet (an edge case only reachable by closing the round
      // the instant the last window closes) is simply left for the grader to
      // decide manually rather than blocking the round close on it.
      for (const question of questions) {
        if (question.status !== 'window_closed') continue
        try {
          await autoMarkQuestionAnswers(question.id)
        } catch (err) {
          if (!getErrorMessage(err, '').includes('grace period')) throw err
        }
      }
      await closeRound(roundId)
      setRound(await getRound(roundId))
      await refreshAnswers()
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to close round'))
    } finally {
      setClosingRound(false)
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

  if (!event || !round || !questions || !roster) {
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
            <PageTitle>
              Live console — Round {round.sequence}: {round.name}
            </PageTitle>
            <PageSubtitle>{event.name}</PageSubtitle>
          </div>
          <BackLink to={`/events/${eventId}/rounds`}>Back to rounds</BackLink>
        </PageHeader>

        {round.status !== 'scoring_open' && (
          <HelpText>
            {round.status === 'pending'
              ? 'This round has not opened for scoring yet.'
              : `This round is ${round.status.replace('_', ' ')} — no further questions can be revealed.`}
          </HelpText>
        )}

        {(round.status === 'scoring_closed' || round.status === 'advanced') && (
          <Row>
            <LinkButton
              to={`/events/${eventId}/rounds/${roundId}/grade`}
              tone="primary"
            >
              Grade round
            </LinkButton>
          </Row>
        )}

        {actionError && <ErrorText role="alert">{actionError}</ErrorText>}

        {round.status === 'scoring_open' && (
          <Card>
            <SectionTitle>Current question</SectionTitle>

            {openQuestion && (
              <>
                <QuestionPrompt>{openQuestion.prompt}</QuestionPrompt>
                <DefinitionGrid>
                  <DefinitionTerm>Segment</DefinitionTerm>
                  <DefinitionValue>{openQuestion.segment_name}</DefinitionValue>
                  <DefinitionTerm>Answer type</DefinitionTerm>
                  <DefinitionValue>{openQuestion.answer_type}</DefinitionValue>
                </DefinitionGrid>
                <Countdown aria-live="polite">{formatClock(remainingMs ?? 0)}</Countdown>
                <Row>
                  <Button
                    type="button"
                    tone="danger"
                    onClick={() => setQuestionPendingVoid(openQuestion)}
                    disabled={voidingId === openQuestion.id}
                  >
                    {voidingId === openQuestion.id ? 'Voiding…' : 'Void question'}
                  </Button>
                </Row>
              </>
            )}

            {!openQuestion && nextPendingQuestion && (
              <>
                <QuestionPrompt>{nextPendingQuestion.prompt}</QuestionPrompt>
                <DefinitionGrid>
                  <DefinitionTerm>Segment</DefinitionTerm>
                  <DefinitionValue>{nextPendingQuestion.segment_name}</DefinitionValue>
                  <DefinitionTerm>Answer window</DefinitionTerm>
                  <DefinitionValue>{nextPendingQuestion.window_seconds}s</DefinitionValue>
                </DefinitionGrid>
                <Row>
                  <Button
                    type="button"
                    tone="success"
                    onClick={() => handleReveal(nextPendingQuestion.id)}
                    disabled={revealingId === nextPendingQuestion.id}
                  >
                    {revealingId === nextPendingQuestion.id ? 'Revealing…' : 'Reveal question'}
                  </Button>
                </Row>
              </>
            )}

            {!openQuestion && !nextPendingQuestion && questions.length === 0 && (
              <HelpText>This round has no questions configured yet.</HelpText>
            )}

            {!openQuestion && !nextPendingQuestion && questions.length > 0 && (
              <>
                <HelpText>Every question in this round is closed or voided.</HelpText>
                <Row>
                  <Button
                    type="button"
                    tone="primary"
                    onClick={() => setConfirmingCloseRound(true)}
                    disabled={!allQuestionsDone || closingRound}
                  >
                    {closingRound ? 'Closing round…' : 'Close round'}
                  </Button>
                </Row>
              </>
            )}
          </Card>
        )}

        {focusedQuestion && (
          <Card>
            <SectionTitle>Who's answered — Question {focusedQuestion.sequence}</SectionTitle>
            {roster.length === 0 ? (
              <EmptyState>No active participants in this round.</EmptyState>
            ) : (
              <RosterGrid>
                {roster.map((rp) => {
                  const hasAnswered = answeredParticipantIds.has(rp.participant_id)
                  return (
                    <RosterItem key={rp.id} answered={hasAnswered ? 'yes' : 'no'}>
                      {rp.participant.name}
                      {hasAnswered ? ' ✓' : ''}
                    </RosterItem>
                  )
                })}
              </RosterGrid>
            )}
            <HelpText>
              {answeredParticipantIds.size} of {roster.length} answered.
              {integrityCountByQuestion[focusedQuestion.id]
                ? ` ${integrityCountByQuestion[focusedQuestion.id]} integrity event(s) logged for this question.`
                : ''}
            </HelpText>
          </Card>
        )}

        <Card>
          <SectionTitle>All questions</SectionTitle>
          {questions.length === 0 && <EmptyState>No questions yet.</EmptyState>}
          {questions.map((q) => (
            <DefinitionGrid key={q.id}>
              <DefinitionTerm>
                {q.segment_name} · Q{q.sequence}
              </DefinitionTerm>
              <DefinitionValue>
                {q.status.replace('_', ' ')}
                {integrityCountByQuestion[q.id]
                  ? ` · ${integrityCountByQuestion[q.id]} integrity event(s)`
                  : ''}
              </DefinitionValue>
            </DefinitionGrid>
          ))}
        </Card>
      </PageInner>

      <ConfirmDialog
        open={questionPendingVoid !== null}
        title="Void this question?"
        description={
          questionPendingVoid
            ? `Voiding "${questionPendingVoid.prompt}" permanently discards every submitted answer to it. This cannot be undone.`
            : ''
        }
        confirmLabel="Void question"
        tone="danger"
        onConfirm={confirmVoid}
        onCancel={() => setQuestionPendingVoid(null)}
      />

      <ConfirmDialog
        open={confirmingCloseRound}
        title="Close this round?"
        description="Closing the round ends scoring for it. Reviewing advancement and declaring a winner happens next."
        confirmLabel="Close round"
        tone="primary"
        onConfirm={confirmCloseRound}
        onCancel={() => setConfirmingCloseRound(false)}
      />
    </PageShell>
  )
}
