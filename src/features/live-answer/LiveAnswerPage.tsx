import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'
import { supabase } from '../../lib/supabase'
import { formatClock, getDeadlineMs } from '../../lib/quiz-timing'
import { useAuth } from '../auth/useAuth'
import { AuthShell, ErrorText, Input, LoadingScreen } from '../auth/auth-ui'
import { Button } from '../../components/ui/Button'
import { Title as PageTitle, Subtitle as PageSubtitle } from '../../components/ui/Typography'
import { getEvent } from '../events/events-api'
import { DefinitionGrid, DefinitionTerm, DefinitionValue, HelpText } from '../events/events-ui'
import type { EventRow } from '../events/types'
import { listRoundQuestions } from '../live-quiz/live-quiz-api'
import type { RoundQuestion } from '../live-quiz/live-quiz-api'
import type { AnswerRow } from '../live-quiz/types'
import { getErrorMessage as getLoadErrorMessage, getMyParticipant } from '../participants/participants-api'
import type { ParticipantRow } from '../participants/types'
import { listRounds } from '../rounds/rounds-api'
import type { RoundRow } from '../rounds/types'
import { getAnswerDraft, setAnswerDraft } from './answer-draft'
import { getErrorMessage as getSubmitErrorMessage, getMyAnswer, submitAnswer } from './live-answer-api'
import { useFocusIntegrity } from './useFocusIntegrity'

const ScreenCard = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4',
    width: 'full',
    maxWidth: '96',
    bg: 'bg.surface',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'card',
    p: '6',
  },
})

const CenteredCard = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4',
    width: 'full',
    maxWidth: '96',
    bg: 'bg.surface',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'card',
    p: '6',
    textAlign: 'center',
    alignItems: 'center',
  },
})

const StatusMessage = styled('p', {
  base: { fontSize: 'sm', color: 'text.muted' },
})

const QuestionPrompt = styled('p', {
  base: { fontSize: 'lg', fontWeight: 'semibold', color: 'text.primary' },
})

const Countdown = styled('div', {
  base: {
    fontSize: '4xl',
    fontWeight: 'bold',
    fontVariantNumeric: 'tabular-nums',
    color: 'text.primary',
    textAlign: 'center',
  },
})

const SubmitStatus = styled('p', {
  base: { fontSize: 'xs', color: 'text.muted' },
})

const WarningBanner = styled('p', {
  base: {
    fontSize: 'sm',
    fontWeight: 'medium',
    color: 'amber.400',
    borderWidth: '1px',
    borderColor: 'amber.400',
    borderRadius: 'card',
    p: '2',
    textAlign: 'center',
  },
})

export function LiveAnswerPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { user } = useAuth()

  const [event, setEvent] = useState<EventRow | null>(null)
  const [participant, setParticipant] = useState<ParticipantRow | null>(null)
  const [rounds, setRounds] = useState<RoundRow[] | null>(null)
  const [questions, setQuestions] = useState<RoundQuestion[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [myAnswer, setMyAnswer] = useState<AnswerRow | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)

  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!eventId || !user) return

    let cancelled = false
    Promise.all([getEvent(eventId), getMyParticipant(eventId, user.id)])
      .then(([eventRow, participantRow]) => {
        if (cancelled) return
        setEvent(eventRow)
        setParticipant(participantRow)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getLoadErrorMessage(err, 'Failed to load the quiz'))
      })

    return () => {
      cancelled = true
    }
  }, [eventId, user])

  const approved = participant?.admission_status === 'approved'

  useEffect(() => {
    if (!eventId || !approved) return

    let cancelled = false
    listRounds(eventId)
      .then((rows) => {
        if (!cancelled) setRounds(rows)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getLoadErrorMessage(err, 'Failed to load the round'))
      })

    return () => {
      cancelled = true
    }
  }, [eventId, approved])

  // Live round-status transitions (round 1 closes, round 2 opens via
  // advance_round) — rounds.event_id is a real indexed column, so this can
  // filter server-side.
  useEffect(() => {
    if (!eventId || !approved) return

    const channel = supabase
      .channel(`live-answer-rounds-${eventId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rounds', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const updated = payload.new as RoundRow
          setRounds((prev) =>
            prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev,
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, approved])

  const scoringOpenRound = useMemo(
    () => rounds?.find((r) => r.status === 'scoring_open') ?? null,
    [rounds],
  )
  const roundId = scoringOpenRound?.id ?? null

  const refreshQuestions = useCallback(async () => {
    if (!roundId) return
    const rows = await listRoundQuestions(roundId)
    setQuestions(rows)
  }, [roundId])

  // No reset-to-null branch here: when roundId goes away (no scoring_open
  // round), rendering already short-circuits on scoringOpenRound being null
  // before ever consulting `questions`, so a stale value is harmless and
  // gets overwritten the next time a round actually opens.
  useEffect(() => {
    if (!roundId) return
    let cancelled = false
    listRoundQuestions(roundId)
      .then((rows) => {
        if (!cancelled) setQuestions(rows)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getLoadErrorMessage(err, 'Failed to load the current question'))
      })
    return () => {
      cancelled = true
    }
  }, [roundId])

  // Realtime: question reveal/close/void. A participant's very first sight
  // of a question is the reveal itself (RLS hides it while pending), so
  // there's no already-known id set to filter by client-side — a full
  // refetch on any inbound change is what actually catches a brand-new
  // reveal rather than only updates to rows already loaded.
  useEffect(() => {
    if (!roundId) return

    const channel = supabase
      .channel(`live-answer-questions-${roundId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'questions' }, () => {
        refreshQuestions().catch(() => {
          // Best-effort: the next reveal/close event re-syncs.
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roundId, refreshQuestions])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const openQuestion = useMemo(
    () => questions?.find((q) => q.status === 'window_open') ?? null,
    [questions],
  )

  const focusedQuestion = useMemo(() => {
    if (openQuestion) return openQuestion
    return questions && questions.length > 0 ? questions[questions.length - 1] : null
  }, [openQuestion, questions])

  const deadlineMs = useMemo(
    () => (openQuestion ? getDeadlineMs(openQuestion) : null),
    [openQuestion],
  )
  const remainingMs = deadlineMs !== null ? deadlineMs - now : null

  const focusedQuestionId = focusedQuestion?.id ?? null

  // A lock from a prior question's grace-timeout auto-submit shouldn't
  // carry over once the next question is revealed. Reset during render
  // (React's documented pattern for adjusting state when a prop/derived
  // value changes) rather than in an effect, to avoid an extra commit.
  const [lockedForQuestionId, setLockedForQuestionId] = useState(focusedQuestionId)
  if (focusedQuestionId !== lockedForQuestionId) {
    setLockedForQuestionId(focusedQuestionId)
    setLocked(false)
  }

  // Load (or reset) the answer draft whenever the focused question changes:
  // prefer what was actually submitted (server truth) over a local draft,
  // since a submitted answer is never stale relative to a leftover draft.
  useEffect(() => {
    const participantId = participant?.id
    if (!focusedQuestionId || !participantId) return

    let cancelled = false
    getMyAnswer(participantId, focusedQuestionId)
      .then((answer) => {
        if (cancelled) return
        setMyAnswer(answer)
        setAnswerText(answer?.submitted_text ?? getAnswerDraft(focusedQuestionId) ?? '')
      })
      .catch(() => {
        if (!cancelled) setAnswerText(getAnswerDraft(focusedQuestionId) ?? '')
      })

    return () => {
      cancelled = true
    }
  }, [focusedQuestionId, participant?.id])

  function handleAnswerChange(value: string) {
    setAnswerText(value)
    if (focusedQuestionId) setAnswerDraft(focusedQuestionId, value)
  }

  async function handleSubmit() {
    if (!openQuestion || !openQuestion.revealed_at || !openQuestion.reveal_token) return

    setSubmitError(null)
    setSubmitting(true)
    try {
      const clientElapsedMs = Math.max(0, Date.now() - new Date(openQuestion.revealed_at).getTime())
      const answer = await submitAnswer(
        openQuestion.id,
        answerText,
        clientElapsedMs,
        openQuestion.reveal_token,
      )
      setMyAnswer(answer)
    } catch (err) {
      setSubmitError(getSubmitErrorMessage(err, 'Failed to submit your answer'))
    } finally {
      setSubmitting(false)
    }
  }

  const { warning, graceRemainingMs } = useFocusIntegrity({
    participantId: participant?.id ?? null,
    question: focusedQuestion,
    answerText,
    onAutoSubmitted: (answer) => setMyAnswer(answer),
    onLocked: () => setLocked(true),
  })

  if (loadError) {
    return (
      <AuthShell>
        <CenteredCard>
          <PageTitle>Something went wrong</PageTitle>
          <ErrorText role="alert">{loadError}</ErrorText>
        </CenteredCard>
      </AuthShell>
    )
  }

  if (!event || !participant) {
    return <LoadingScreen>Loading…</LoadingScreen>
  }

  if (participant.admission_status !== 'approved') {
    return <Navigate to={`/events/${eventId}/waiting-room`} replace />
  }

  if (!rounds) {
    return <LoadingScreen>Loading…</LoadingScreen>
  }

  if (!scoringOpenRound) {
    return (
      <AuthShell>
        <CenteredCard>
          <PageTitle>{event.name}</PageTitle>
          <StatusMessage>
            Waiting for the quiz to start. This page updates automatically — no
            need to refresh.
          </StatusMessage>
        </CenteredCard>
      </AuthShell>
    )
  }

  if (questions === null) {
    return <LoadingScreen>Loading…</LoadingScreen>
  }

  if (!focusedQuestion) {
    return (
      <AuthShell>
        <CenteredCard>
          <PageTitle>{event.name}</PageTitle>
          <StatusMessage>Waiting for the first question…</StatusMessage>
        </CenteredCard>
      </AuthShell>
    )
  }

  const isOpen = focusedQuestion.status === 'window_open'
  const hasUnsavedChanges = answerText !== (myAnswer?.submitted_text ?? '')

  return (
    <AuthShell>
      <ScreenCard>
        <div>
          <PageTitle>{event.name}</PageTitle>
          <PageSubtitle>{participant.name}</PageSubtitle>
        </div>

        <QuestionPrompt>{focusedQuestion.prompt}</QuestionPrompt>
        <DefinitionGrid>
          <DefinitionTerm>Segment</DefinitionTerm>
          <DefinitionValue>{focusedQuestion.segment_name}</DefinitionValue>
          <DefinitionTerm>Answer type</DefinitionTerm>
          <DefinitionValue>{focusedQuestion.answer_type}</DefinitionValue>
        </DefinitionGrid>

        {isOpen && (
          <Countdown aria-live="polite">{formatClock(remainingMs ?? 0)}</Countdown>
        )}

        {focusedQuestion.status === 'voided' && (
          <HelpText>This question was voided — it won't be scored.</HelpText>
        )}

        {focusedQuestion.status === 'window_closed' && (
          <HelpText>Time's up. Waiting for the next question…</HelpText>
        )}

        {warning && (
          <WarningBanner role="alert" aria-live="assertive">
            You left the screen — your answer auto-submits in{' '}
            {Math.ceil(graceRemainingMs / 1000)}s unless you return.
          </WarningBanner>
        )}

        <Input
          value={answerText}
          onChange={(e) => handleAnswerChange(e.target.value)}
          inputMode={focusedQuestion.answer_type === 'numeric' ? 'decimal' : 'text'}
          placeholder="Your answer"
          disabled={!isOpen || locked}
          aria-label="Your answer"
        />

        {submitError && <ErrorText role="alert">{submitError}</ErrorText>}

        {isOpen && !locked && (
          <Button
            type="button"
            tone="success"
            onClick={handleSubmit}
            disabled={submitting || answerText.trim() === ''}
          >
            {submitting ? 'Submitting…' : 'Submit answer'}
          </Button>
        )}

        {locked && (
          <SubmitStatus>
            Auto-submitted because you left the screen — you can't edit this answer anymore.
          </SubmitStatus>
        )}
        {!locked && !isOpen && myAnswer?.submitted_text && (
          <SubmitStatus>Your answer: {myAnswer.submitted_text}</SubmitStatus>
        )}
        {!locked && !isOpen && !myAnswer?.submitted_text && (
          <SubmitStatus>You didn't submit an answer for this question.</SubmitStatus>
        )}
        {!locked && isOpen && myAnswer && !hasUnsavedChanges && (
          <SubmitStatus>Submitted ✓ — you can still change it until time's up.</SubmitStatus>
        )}
        {!locked && isOpen && hasUnsavedChanges && (
          <SubmitStatus>Not yet submitted.</SubmitStatus>
        )}
      </ScreenCard>
    </AuthShell>
  )
}
