import { supabase } from '../../lib/supabase'
import type { AnswerRow, IntegrityEventKind } from '../live-quiz/types'

export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}

// Best-effort audit write to the grader's integrity log (QA1's
// integrity_events, RLS-writable by the owning participant with no
// time-window gate). Never throws to the caller — a failed log write is a
// missed audit trail entry, not a reason to interrupt the participant.
export async function logIntegrityEvent(
  participantId: string,
  questionId: string | null,
  kind: IntegrityEventKind,
  occurredAt: string,
  durationMs: number | null = null,
): Promise<void> {
  try {
    await supabase.from('integrity_events').insert({
      participant_id: participantId,
      question_id: questionId,
      kind,
      occurred_at: occurredAt,
      duration_ms: durationMs,
    })
  } catch {
    // Best-effort — see comment above.
  }
}

// The grace-then-submit timeout's "submit the current draft on the way
// out" leg. The plan calls for `navigator.sendBeacon`, but sendBeacon can't
// carry an `Authorization` header, which QA6's submit_answer RPC requires
// (it's SECURITY DEFINER and checks auth.uid()) — so this uses `fetch` with
// `keepalive: true` instead. Like sendBeacon, a keepalive fetch is handed
// off to the browser and keeps going even if the page unloads immediately
// after; unlike sendBeacon, it can still set the bearer token. Returns null
// (rather than throwing) on any failure — the caller still has the
// integrity log as a fallback record that the participant left.
export async function beaconSubmitAnswer(params: {
  questionId: string
  submittedText: string
  clientElapsedMs: number
  revealToken: string
}): Promise<AnswerRow | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) return null

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/submit_answer`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_question_id: params.questionId,
        p_submitted_text: params.submittedText,
        p_client_elapsed_ms: params.clientElapsedMs,
        p_reveal_token: params.revealToken,
        p_is_saved_draft: true,
      }),
    })

    if (!res.ok) return null
    return (await res.json()) as AnswerRow
  } catch {
    return null
  }
}
