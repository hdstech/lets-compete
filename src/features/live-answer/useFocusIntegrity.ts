import { useEffect, useRef, useState } from 'react'
import type { RoundQuestion } from '../live-quiz/live-quiz-api'
import type { AnswerRow } from '../live-quiz/types'
import { beaconSubmitAnswer, logIntegrityEvent } from './focus-integrity-api'

// Short relative to a typical question window, long enough for a fumbled
// tab-switch to recover in. Bounded per-away-event by the time actually
// left in the question's window (see startGrace below) — it can never let
// a participant buy time past the server-side close.
const GRACE_MS = 15_000

// setTimeout doesn't fire at the exact millisecond requested — a few ms of
// event-loop jitter is normal, more so with another interval (the
// countdown tick) also running. Padding the bound by this much means the
// timeout reliably fires *before* the window's absolute deadline, so the
// auto-submit's client_elapsed_ms (computed at fire time) doesn't land a
// few ms past submit_answer's window_seconds*1000 check and get rejected.
const GRACE_SAFETY_MARGIN_MS = 500

export type FocusIntegrityState = {
  warning: boolean
  graceRemainingMs: number
}

// Detects and deters leaving the live-answer screen while a question is
// open, per the plan's anti-navigation / focus-integrity layer:
//   - `beforeunload` (explicit close/reload/URL change) → native warning
//     only, plus a log entry. This can't itself submit anything — a real
//     unload kills the JS context an instant later, past the point any
//     async work here could complete.
//   - `visibilitychange`→hidden, `pagehide`, and `window.blur` (leaving the
//     screen without necessarily navigating away — tab switch, app switch,
//     alt-tab) all arm the *same* grace-then-submit countdown: `return`
//     (visibility back / window focus) before it expires cancels the
//     countdown and resumes editing; timing out submits the current draft
//     and locks the question locally.
// A web app can detect and deter this, not prevent it — this layer raises
// the cost of casual cheating and produces evidence for the grader; it is
// not a proctoring system.
//
// `question` should be the *focused* question (whatever its status), not
// only the currently-open one: the window can close server-side (the
// organizer's own countdown auto-closes it right at the deadline) at
// almost exactly the moment a grace period bounded by "time left in the
// window" is expiring. Keying this hook's mount/teardown off question id
// rather than off `status === 'window_open'` means that race doesn't tear
// down an in-flight grace timer out from under itself.
export function useFocusIntegrity(params: {
  participantId: string | null
  question: RoundQuestion | null
  answerText: string
  onAutoSubmitted: (answer: AnswerRow) => void
  onLocked: () => void
}): FocusIntegrityState {
  const { participantId, question, onAutoSubmitted, onLocked } = params

  const [warning, setWarning] = useState(false)
  const [graceRemainingMs, setGraceRemainingMs] = useState(0)

  // Refs so the event listeners (attached once per question/participant,
  // not per keystroke or poll tick) always see the latest draft text /
  // question fields / callbacks without needing to be torn down and
  // re-attached constantly.
  const answerTextRef = useRef(params.answerText)
  useEffect(() => {
    answerTextRef.current = params.answerText
  }, [params.answerText])

  const questionRef = useRef(question)
  useEffect(() => {
    questionRef.current = question
  }, [question])

  const participantIdRef = useRef(participantId)
  useEffect(() => {
    participantIdRef.current = participantId
  }, [participantId])

  const onAutoSubmittedRef = useRef(onAutoSubmitted)
  useEffect(() => {
    onAutoSubmittedRef.current = onAutoSubmitted
  }, [onAutoSubmitted])

  const onLockedRef = useRef(onLocked)
  useEffect(() => {
    onLockedRef.current = onLocked
  }, [onLocked])

  const questionId = question?.id ?? null
  const shouldMount = Boolean(participantId && questionId)

  useEffect(() => {
    if (!shouldMount) return

    const awaySinceRef: { current: number | null } = { current: null }
    const graceTimeoutRef: { current: ReturnType<typeof setTimeout> | null } = { current: null }
    const tickIntervalRef: { current: ReturnType<typeof setInterval> | null } = { current: null }

    function clearGrace() {
      if (graceTimeoutRef.current) {
        clearTimeout(graceTimeoutRef.current)
        graceTimeoutRef.current = null
      }
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current)
        tickIntervalRef.current = null
      }
      setWarning(false)
      setGraceRemainingMs(0)
    }

    async function autoSubmit() {
      const q = questionRef.current
      const pid = participantIdRef.current
      if (!q || !q.revealed_at || !q.reveal_token || !pid) return

      const clientElapsedMs = Math.max(0, Date.now() - new Date(q.revealed_at).getTime())
      const answer = await beaconSubmitAnswer({
        questionId: q.id,
        submittedText: answerTextRef.current,
        clientElapsedMs,
        revealToken: q.reveal_token,
      })
      if (answer) onAutoSubmittedRef.current(answer)

      void logIntegrityEvent(pid, q.id, 'auto_submit', new Date().toISOString())
      onLockedRef.current()
      awaySinceRef.current = null
      clearGrace()
    }

    function startGrace() {
      if (awaySinceRef.current !== null) return // already counting down

      const q = questionRef.current
      if (!q || q.status !== 'window_open' || !q.revealed_at) return

      awaySinceRef.current = Date.now()
      const deadlineMs = new Date(q.revealed_at).getTime() + q.window_seconds * 1000
      const timeLeftMs = deadlineMs - Date.now() - GRACE_SAFETY_MARGIN_MS
      const effectiveGraceMs = Math.max(0, Math.min(GRACE_MS, timeLeftMs))

      setWarning(true)
      setGraceRemainingMs(effectiveGraceMs)

      tickIntervalRef.current = setInterval(() => {
        setGraceRemainingMs((prev) => Math.max(0, prev - 1000))
      }, 1000)

      graceTimeoutRef.current = setTimeout(() => {
        void autoSubmit()
      }, effectiveGraceMs)
    }

    function handleAway(kind: 'hidden' | 'blur') {
      const q = questionRef.current
      // Nothing to guard (or grace already running) once the window's not
      // open — an away-event on an already-closed/voided question isn't
      // worth logging.
      if (!q || q.status !== 'window_open') return

      const pid = participantIdRef.current
      if (pid) void logIntegrityEvent(pid, q.id, kind, new Date().toISOString())
      startGrace()
    }

    function handleReturn() {
      if (awaySinceRef.current === null) return
      const durationMs = Date.now() - awaySinceRef.current
      const pid = participantIdRef.current
      const q = questionRef.current
      if (pid) void logIntegrityEvent(pid, q?.id ?? null, 'return', new Date().toISOString(), durationMs)
      awaySinceRef.current = null
      clearGrace()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        handleAway('hidden')
      } else {
        handleReturn()
      }
    }

    function handleBlur() {
      handleAway('blur')
    }

    function handleFocus() {
      handleReturn()
    }

    // pagehide is bucketed with visibilitychange/blur in the plan as a
    // "leaving the screen" trigger, distinct from beforeunload's explicit-
    // navigation warning — it also fires for some backgrounding cases where
    // JS keeps running (notably iOS Safari, where beforeunload is
    // unreliable), so it gets the same grace treatment rather than an
    // immediate hard submit. Logged as 'hidden' since the integrity_events
    // kind enum has no separate value for it and the two mean the same
    // thing to the grader: the participant stopped looking at the screen.
    function handlePageHide() {
      handleAway('hidden')
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      const q = questionRef.current
      if (!q || q.status !== 'window_open') return

      const pid = participantIdRef.current
      if (pid) void logIntegrityEvent(pid, q.id, 'beforeunload', new Date().toISOString())
      event.preventDefault()
      event.returnValue = ''
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      clearGrace()
      awaySinceRef.current = null
    }
  }, [shouldMount, questionId])

  return { warning, graceRemainingMs }
}
