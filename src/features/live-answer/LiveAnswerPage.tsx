import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'
import { formatClock, getDeadlineMs } from '../../lib/quiz-timing'
import { combineRealtimeStatus, useRealtimeChannel } from '../../lib/use-realtime-channel'
import { LiveStatusBadge } from '../../components/ui/LiveStatusBadge'
import { useToast } from '../../components/ui/useToast'
import { useAuth } from '../auth/useAuth'
import { ErrorText, Input, LoadingScreen } from '../auth/auth-ui'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/ErrorState'
import { PlayerHeader } from '../../components/ui/PlayerHeader'
import {
  PlayerBody,
  PlayerHeaderBadge,
  PlayerShell,
} from '../../components/ui/PlayerShell'
import { LoadingBlock } from '../../components/ui/LoadingBlock'
import { getEvent } from '../events/events-api'
import { HelpText } from '../events/events-ui'
import type { EventRow } from '../events/types'
import { listRoundQuestions } from '../live-quiz/live-quiz-api'
import type { RoundQuestion } from '../live-quiz/live-quiz-api'
import type { AnswerRow } from '../live-quiz/types'
import { getErrorMessage as getLoadErrorMessage, getMyParticipant } from '../participants/participants-api'
import type { ParticipantRow } from '../participants/types'
import { listRounds } from '../rounds/rounds-api'
import type { RoundRow } from '../rounds/types'
import { answerTypeLabel, BOOLEAN_ANSWER_VALUES } from '../questions/answer-type'
import { getAnswerDraft, setAnswerDraft } from './answer-draft'
import { getErrorMessage as getSubmitErrorMessage, getMyAnswer, submitAnswer } from './live-answer-api'
import { useFocusIntegrity } from './useFocusIntegrity'

const PlayComposer = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3',
    position: 'sticky',
    bottom: '0',
    px: { base: '4', sm: '6' },
    pt: '3',
    bg: 'bg.canvas',
    borderTopWidth: '1px',
    borderColor: 'border.default',
    paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
  },
})

// True/False answers: two equal, thumb-sized targets in place of the text
// box, so the whole answer is one tap on a phone.
const ChoiceRow = styled('div', {
  base: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '3',
  },
})

const StatusMessage = styled('p', {
  base: { fontSize: 'sm', color: 'text.muted' },
})

const QuestionPrompt = styled('p', {
  base: {
    fontSize: { base: '2xl', sm: 'xl' },
    fontWeight: 'bold',
    letterSpacing: '-0.01em',
    color: 'text.primary',
    overflowWrap: 'anywhere',
  },
})

const Countdown = styled('div', {
  base: {
    fontSize: { base: '4xl', sm: '4xl' },
    fontWeight: 'bold',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.02em',
    color: 'accent.default',
    textAlign: 'center',
    transition: 'color 0.2s ease',
  },
  variants: {
    // The last few seconds, where the number has to pull the eye up from
    // the keyboard.
    urgent: {
      true: { color: 'danger.fg' },
    },
  },
})

const CountdownTrack = styled('div', {
  base: {
    height: '1.5',
    width: 'full',
    borderRadius: 'pill',
    bg: 'bg.sunken',
    overflow: 'hidden',
  },
})

const CountdownFill = styled('div', {
  base: {
    height: 'full',
    borderRadius: 'pill',
    bg: 'accent.solid',
    transition: 'width 0.95s linear, background-color 0.2s ease',
    _motionReduce: { transition: 'none' },
  },
  variants: {
    urgent: {
      true: { bg: 'salmon.600' },
    },
  },
})

const SubmitStatus = styled('p', {
  base: { fontSize: 'xs', color: 'text.muted' },
})

const WarningBanner = styled('p', {
  base: {
    fontSize: 'sm',
    fontWeight: 'medium',
    color: 'warning.fg',
    bg: 'warning.subtle',
    borderWidth: '1px',
    borderColor: 'warning.border',
    borderRadius: 'control',
    p: '2.5',
    textAlign: 'center',
  },
})

export function LiveAnswerPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { user } = useAuth()
  const { showError } = useToast()

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
  const [autoSubmitFailed, setAutoSubmitFailed] = useState(false)

  const [now, setNow] = useState(() => Date.now())

  // Bumped by the "Try again" button on a load failure — included in every
  // fetch effect below so retrying re-runs whichever stage actually failed,
  // without needing to track which of the three independent loads it was.
  const [retryToken, setRetryToken] = useState(0)
  const retryLoad = useCallback(() => {
    setLoadError(null)
    setRetryToken((t) => t + 1)
  }, [])

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
  }, [eventId, user, retryToken])

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
  }, [eventId, approved, retryToken])

  // Live round-status transitions (round 1 closes, round 2 opens via
  // advance_round) — rounds.event_id is a real indexed column, so this can
  // filter server-side.
  const refreshRounds = useCallback(async () => {
    if (!eventId) return
    setRounds(await listRounds(eventId))
  }, [eventId])

  const roundsStatus = useRealtimeChannel({
    channelName: eventId && approved ? `live-answer-rounds-${eventId}` : null,
    subscribe: useCallback(
      (channel) =>
        channel.on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'rounds', filter: `event_id=eq.${eventId}` },
          (payload) => {
            const updated = payload.new as RoundRow
            setRounds((prev) =>
              prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev,
            )
          },
        ),
      [eventId],
    ),
    onReconnect: refreshRounds,
  })

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
  }, [roundId, retryToken])

  // Realtime: question reveal/close/void. A participant's very first sight
  // of a question is the reveal itself (RLS hides it while pending), so
  // there's no already-known id set to filter by client-side — a full
  // refetch on any inbound change is what actually catches a brand-new
  // reveal rather than only updates to rows already loaded.
  const questionsStatus = useRealtimeChannel({
    channelName: roundId ? `live-answer-questions-${roundId}` : null,
    subscribe: useCallback(
      (channel) =>
        channel.on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'questions' },
          () => {
            refreshQuestions().catch((err: unknown) => {
              // A missed reveal means the participant sits on the previous
              // question while their answer window is already counting down,
              // so this can't stay a silent best-effort catch.
              showError(
                `Couldn't load the latest question — this screen may be behind. ${getLoadErrorMessage(err, 'Reload the page if nothing changes.')}`,
                { key: 'live-answer-question-refresh' },
              )
            })
          },
        ),
      [refreshQuestions, showError],
    ),
    onReconnect: refreshQuestions,
  })

  // Either channel dropping means a reveal or a round change can pass this
  // screen by, so the header reports the weaker of the two.
  const realtimeStatus = combineRealtimeStatus(roundsStatus, questionsStatus)

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
    setAutoSubmitFailed(false)
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
      .catch((err: unknown) => {
        if (cancelled) return
        // Falling back to the local draft is right, but doing it silently
        // leaves the participant unable to tell an answer that was recorded
        // from one that never reached the server — the single worst thing
        // for this screen to be quietly wrong about.
        setAnswerText(getAnswerDraft(focusedQuestionId) ?? '')
        showError(
          `Couldn't confirm whether your answer was already submitted — what's shown is your local draft. ${getSubmitErrorMessage(err, 'Submit again before the window closes.')}`,
          { key: 'live-answer-confirm' },
        )
      })

    return () => {
      cancelled = true
    }
  }, [focusedQuestionId, participant?.id, showError])

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
    onAutoSubmitFailed: () => {
      setAutoSubmitFailed(true)
      showError(
        "You left the screen and your answer couldn't be sent — it may not have been recorded. Tell the organizer before the round closes.",
        { key: 'live-answer-auto-submit' },
      )
    },
    onLocked: () => setLocked(true),
  })

  if (loadError) {
    return (
      <PlayerShell>
        <PlayerHeader title="Something went wrong" />
        <PlayerBody>
          <Card>
            <ErrorState message={loadError} onRetry={retryLoad} />
          </Card>
        </PlayerBody>
      </PlayerShell>
    )
  }

  if (!event || !participant) {
    return (
      <LoadingScreen>
        <LoadingBlock label="Loading the quiz…" />
      </LoadingScreen>
    )
  }

  if (participant.admission_status !== 'approved') {
    return <Navigate to={`/events/${eventId}/waiting-room`} replace />
  }

  if (!rounds) {
    return (
      <LoadingScreen>
        <LoadingBlock label="Loading the round…" />
      </LoadingScreen>
    )
  }

  if (!scoringOpenRound) {
    return (
      <PlayerShell>
        <PlayerHeader title={event.name} subtitle={participant.name}>
          <PlayerHeaderBadge>Waiting to start</PlayerHeaderBadge>
          <LiveStatusBadge status={realtimeStatus} onBrand />
        </PlayerHeader>
        <PlayerBody>
          <Card>
            <StatusMessage>
              Waiting for the quiz to start. This page updates automatically —
              no need to refresh.
            </StatusMessage>
          </Card>
        </PlayerBody>
      </PlayerShell>
    )
  }

  if (questions === null) {
    return (
      <LoadingScreen>
        <LoadingBlock label="Loading the current question…" />
      </LoadingScreen>
    )
  }

  if (!focusedQuestion) {
    return (
      <PlayerShell>
        <PlayerHeader title={event.name} subtitle={participant.name}>
          <PlayerHeaderBadge>Round open</PlayerHeaderBadge>
          <LiveStatusBadge status={realtimeStatus} onBrand />
        </PlayerHeader>
        <PlayerBody>
          <Card>
            <StatusMessage>Waiting for the first question…</StatusMessage>
          </Card>
        </PlayerBody>
      </PlayerShell>
    )
  }

  const isOpen = focusedQuestion.status === 'window_open'
  const hasUnsavedChanges = answerText !== (myAnswer?.submitted_text ?? '')
  // Under ten seconds the clock switches to the danger tone; the bar tracks
  // the same fraction of the server-set window so both agree.
  const urgent = isOpen && remainingMs !== null && remainingMs <= 10_000
  const remainingFraction =
    remainingMs !== null && focusedQuestion.window_seconds > 0
      ? Math.max(0, Math.min(1, remainingMs / (focusedQuestion.window_seconds * 1000)))
      : 0

  return (
    <PlayerShell>
      <PlayerHeader title={event.name} subtitle={participant.name}>
        <PlayerHeaderBadge>{focusedQuestion.segment_name}</PlayerHeaderBadge>
        <PlayerHeaderBadge>{answerTypeLabel(focusedQuestion.answer_type)}</PlayerHeaderBadge>
        <LiveStatusBadge status={realtimeStatus} onBrand />
      </PlayerHeader>

      <PlayerBody>
        <Card>
          <QuestionPrompt>{focusedQuestion.prompt}</QuestionPrompt>

          {isOpen && (
            <div>
              <Countdown urgent={urgent} aria-live="polite">
                {formatClock(remainingMs ?? 0)}
              </Countdown>
              <CountdownTrack aria-hidden="true">
                <CountdownFill
                  urgent={urgent}
                  style={{ width: `${remainingFraction * 100}%` }}
                />
              </CountdownTrack>
            </div>
          )}

          {focusedQuestion.status === 'voided' && (
            <HelpText>This question was voided — it won't be scored.</HelpText>
          )}

          {focusedQuestion.status === 'window_closed' && (
            <HelpText>Time's up. Waiting for the next question…</HelpText>
          )}
        </Card>

        {warning && (
          <WarningBanner role="alert" aria-live="assertive">
            You left the screen — your answer auto-submits in{' '}
            {Math.ceil(graceRemainingMs / 1000)}s unless you return.
          </WarningBanner>
        )}
      </PlayerBody>

      <PlayComposer>
        {focusedQuestion.answer_type === 'boolean' ? (
          <ChoiceRow>
            {BOOLEAN_ANSWER_VALUES.map((value) => (
              <Button
                key={value}
                type="button"
                size="lg"
                tone={answerText === value ? 'accent' : 'secondary'}
                aria-pressed={answerText === value}
                disabled={!isOpen || locked}
                onClick={() => handleAnswerChange(value)}
              >
                {value}
              </Button>
            ))}
          </ChoiceRow>
        ) : (
          <Input
            value={answerText}
            onChange={(e) => handleAnswerChange(e.target.value)}
            inputMode={focusedQuestion.answer_type === 'numeric' ? 'decimal' : 'text'}
            placeholder="Your answer"
            disabled={!isOpen || locked}
            aria-label="Your answer"
          />
        )}

        {submitError && <ErrorText role="alert">{submitError}</ErrorText>}

        {isOpen && !locked && (
          <Button
            type="button"
            tone="success"
            width="full"
            onClick={handleSubmit}
            disabled={submitting || answerText.trim() === ''}
          >
            {submitting ? 'Submitting…' : 'Submit answer'}
          </Button>
        )}

        {locked &&
          (autoSubmitFailed ? (
            // Saying "auto-submitted" here when the request never landed
            // would be the most misleading thing on the screen.
            <ErrorText role="alert">
              You left the screen, and your answer couldn't be sent — it may not have
              been recorded. Tell the organizer before the round closes.
            </ErrorText>
          ) : (
            <SubmitStatus>
              Auto-submitted because you left the screen — you can't edit this answer
              anymore.
            </SubmitStatus>
          ))}
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
      </PlayComposer>
    </PlayerShell>
  )
}
