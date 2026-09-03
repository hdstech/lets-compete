import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'
import { ErrorText } from '../auth/auth-ui'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
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
  Row,
  SectionTitle,
} from '../events/events-ui'
import type { EventRow } from '../events/types'
import { listIntegrityEventsForQuestions, listRoundQuestions } from '../live-quiz/live-quiz-api'
import type { RoundQuestion } from '../live-quiz/live-quiz-api'
import type { AnswerRow, IntegrityEventRow, ParticipantRow } from '../live-quiz/types'
import { listAcceptableAnswers } from '../questions/questions-api'
import type { AcceptableAnswerRow } from '../questions/types'
import { getRound } from '../rounds/rounds-api'
import type { RoundRow } from '../rounds/types'
import {
  adjudicateRoundAnswers,
  getErrorMessage,
  listAnswersForRound,
  listParticipantsByIds,
} from './grading-api'

const QuestionPrompt = styled('p', {
  base: { fontSize: 'md', fontWeight: 'semibold', color: 'text.primary' },
})

const AnswerList = styled('div', {
  base: { display: 'flex', flexDirection: 'column', gap: '2' },
})

const AnswerRowEl = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '3',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'control',
    px: '3',
    py: '2.5',
  },
})

const AnswerIdentity = styled('div', {
  base: { display: 'flex', flexDirection: 'column', gap: '0.5', minWidth: '0' },
})

const ParticipantNameText = styled('span', {
  base: { fontSize: 'sm', fontWeight: 'semibold', color: 'text.primary' },
})

const SubmittedText = styled('span', {
  base: { fontSize: 'sm', color: 'text.muted' },
})

const IntegrityBadge = styled('span', {
  base: {
    fontSize: 'xs',
    fontWeight: 'semibold',
    color: 'amber.400',
  },
})

const DecisionToggle = styled('button', {
  base: {
    fontSize: 'xs',
    fontWeight: 'semibold',
    borderRadius: 'full',
    px: '2.5',
    py: '1',
    borderWidth: '1px',
    borderColor: 'transparent',
    cursor: 'pointer',
    flexShrink: 0,
  },
  variants: {
    correct: {
      yes: { bg: 'green.700', color: 'green.50' },
      no: { bg: 'red.700', color: 'red.50' },
    },
  },
})

const DecisionStatic = styled('span', {
  base: {
    fontSize: 'xs',
    fontWeight: 'semibold',
    borderRadius: 'full',
    px: '2.5',
    py: '1',
    flexShrink: 0,
  },
  variants: {
    correct: {
      yes: { bg: 'green.700', color: 'green.50' },
      no: { bg: 'red.700', color: 'red.50' },
    },
  },
})

export function GradingPage() {
  const { eventId, roundId } = useParams<{ eventId: string; roundId: string }>()

  const [event, setEvent] = useState<EventRow | null>(null)
  const [round, setRound] = useState<RoundRow | null>(null)
  const [questions, setQuestions] = useState<RoundQuestion[] | null>(null)
  const [participants, setParticipants] = useState<ParticipantRow[] | null>(null)
  const [answers, setAnswers] = useState<AnswerRow[] | null>(null)
  const [integrityEvents, setIntegrityEvents] = useState<IntegrityEventRow[]>([])
  const [acceptableAnswers, setAcceptableAnswers] = useState<
    Record<string, AcceptableAnswerRow[]>
  >({})
  const [loadError, setLoadError] = useState<string | null>(null)

  const [decisions, setDecisions] = useState<Record<string, boolean>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmingSubmit, setConfirmingSubmit] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    if (!eventId || !roundId) return

    let cancelled = false
    Promise.all([
      getEvent(eventId),
      getRound(roundId),
      listRoundQuestions(roundId),
      listAnswersForRound(roundId),
    ])
      .then(async ([eventRow, roundRow, questionRows, answerRows]) => {
        if (cancelled) return
        const questionIds = questionRows.map((q) => q.id)
        const participantIds = [...new Set(answerRows.map((a) => a.participant_id))]
        const [integrityRows, acceptableLists, participantRows] = await Promise.all([
          listIntegrityEventsForQuestions(questionIds),
          Promise.all(questionRows.map((q) => listAcceptableAnswers(q.id))),
          listParticipantsByIds(participantIds),
        ])
        if (cancelled) return

        setEvent(eventRow)
        setRound(roundRow)
        setQuestions(questionRows)
        setParticipants(participantRows)
        setAnswers(answerRows)
        setIntegrityEvents(integrityRows)
        setAcceptableAnswers(
          Object.fromEntries(questionRows.map((q, i) => [q.id, acceptableLists[i]])),
        )
        setDecisions(
          Object.fromEntries(
            answerRows.map((a) => [a.id, a.final_correct ?? a.auto_correct ?? false]),
          ),
        )
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [eventId, roundId])

  const participantsById = useMemo(() => {
    const map = new Map<string, ParticipantRow>()
    for (const participant of participants ?? []) {
      map.set(participant.id, participant)
    }
    return map
  }, [participants])

  const answersByQuestion = useMemo(() => {
    const map = new Map<string, AnswerRow[]>()
    for (const answer of answers ?? []) {
      const list = map.get(answer.question_id) ?? []
      list.push(answer)
      map.set(answer.question_id, list)
    }
    return map
  }, [answers])

  const integrityCountByParticipantAndQuestion = useMemo(() => {
    const counts = new Map<string, number>()
    for (const event of integrityEvents) {
      if (!event.question_id) continue
      const key = `${event.participant_id}:${event.question_id}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [integrityEvents])

  const canEditGrades = round?.status === 'scoring_closed'
  const totalAnswers = answers?.length ?? 0

  function toggleDecision(answerId: string) {
    if (!canEditGrades) return
    setJustSaved(false)
    setDecisions((prev) => ({ ...prev, [answerId]: !prev[answerId] }))
  }

  async function confirmSubmit() {
    if (!roundId || !answers) return
    setConfirmingSubmit(false)
    setSubmitError(null)
    setSubmitting(true)
    try {
      const grades = answers.map((a) => ({
        answer_id: a.id,
        final_correct: decisions[a.id] ?? false,
      }))
      const updated = await adjudicateRoundAnswers(roundId, grades)
      setAnswers(updated)
      setJustSaved(true)
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Failed to save grades'))
    } finally {
      setSubmitting(false)
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

  if (!event || !round || !questions || !participants || !answers) {
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
              Grade — Round {round.sequence}: {round.name}
            </PageTitle>
            <PageSubtitle>{event.name}</PageSubtitle>
          </div>
          <BackLink to={`/events/${eventId}/rounds`}>Back to rounds</BackLink>
        </PageHeader>

        {round.status === 'pending' || round.status === 'scoring_open' ? (
          <HelpText>
            This round hasn't closed for scoring yet. Grading opens once every
            question is closed or voided and the round is closed from the
            live console.
          </HelpText>
        ) : (
          <>
            {round.status === 'advanced' && (
              <HelpText>
                This round has already advanced — grades are locked and shown
                for reference only.
              </HelpText>
            )}

            {submitError && <ErrorText role="alert">{submitError}</ErrorText>}

            {questions.length === 0 && <EmptyState>No questions in this round.</EmptyState>}

            {questions.map((question) => {
              const questionAnswers = answersByQuestion.get(question.id) ?? []
              const acceptable = acceptableAnswers[question.id] ?? []

              return (
                <Card key={question.id}>
                  <SectionTitle>
                    {question.segment_name} · Q{question.sequence}
                  </SectionTitle>
                  <QuestionPrompt>{question.prompt}</QuestionPrompt>
                  {acceptable.length > 0 && (
                    <HelpText>
                      Acceptable: {acceptable.map((a) => a.value).join(', ')}
                    </HelpText>
                  )}

                  {questionAnswers.length === 0 ? (
                    <HelpText>No answers were submitted for this question.</HelpText>
                  ) : (
                    <AnswerList>
                      {questionAnswers.map((answer) => {
                        const participant = participantsById.get(answer.participant_id)
                        const integrityCount = integrityCountByParticipantAndQuestion.get(
                          `${answer.participant_id}:${question.id}`,
                        )
                        const isCorrect = decisions[answer.id] ?? false

                        return (
                          <AnswerRowEl key={answer.id}>
                            <AnswerIdentity>
                              <ParticipantNameText>
                                {participant?.name ?? 'Unknown participant'}
                              </ParticipantNameText>
                              <SubmittedText>
                                {answer.submitted_text || '(no answer text)'}
                              </SubmittedText>
                              {integrityCount ? (
                                <IntegrityBadge>
                                  ⚠ {integrityCount} integrity event
                                  {integrityCount > 1 ? 's' : ''}
                                </IntegrityBadge>
                              ) : null}
                            </AnswerIdentity>

                            {canEditGrades ? (
                              <DecisionToggle
                                type="button"
                                correct={isCorrect ? 'yes' : 'no'}
                                onClick={() => toggleDecision(answer.id)}
                              >
                                {isCorrect ? 'Correct' : 'Incorrect'}
                              </DecisionToggle>
                            ) : (
                              <DecisionStatic correct={isCorrect ? 'yes' : 'no'}>
                                {isCorrect ? 'Correct' : 'Incorrect'}
                              </DecisionStatic>
                            )}
                          </AnswerRowEl>
                        )
                      })}
                    </AnswerList>
                  )}
                </Card>
              )
            })}

            {canEditGrades && totalAnswers > 0 && (
              <Card>
                <Row>
                  <Button
                    type="button"
                    tone="primary"
                    onClick={() => setConfirmingSubmit(true)}
                    disabled={submitting}
                  >
                    {submitting ? 'Saving grades…' : 'Save grades'}
                  </Button>
                  {justSaved && <HelpText>Grades saved.</HelpText>}
                </Row>
              </Card>
            )}
          </>
        )}
      </PageInner>

      <ConfirmDialog
        open={confirmingSubmit}
        title="Save these grades?"
        description="Confirming or overriding an auto pre-marked answer here sets its final grade for scoring."
        confirmLabel="Save grades"
        tone="primary"
        onConfirm={confirmSubmit}
        onCancel={() => setConfirmingSubmit(false)}
      />
    </PageShell>
  )
}
