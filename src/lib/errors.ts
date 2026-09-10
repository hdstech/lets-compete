// Supabase/PostgREST errors (PostgrestError) are plain objects, not Error
// instances, so callers can't rely on `err instanceof Error` to read a
// meaningful message (e.g. a raised RPC/trigger exception) out of a catch
// block. Every feature's `*-api.ts` re-exports this from one place so
// error copy stays consistent app-wide instead of drifting per feature.

// What kind of failure this is, from the user's point of view rather than
// the transport's. Screens use it to decide *where* a message belongs (a
// dropped connection is worth a toast; a rejected write belongs next to the
// form that was rejected) and whether retrying is even worth offering.
export type ErrorKind =
  | 'offline'
  | 'network'
  | 'auth'
  | 'permission'
  | 'notFound'
  | 'server'
  | 'unknown'

export type ClassifiedError = {
  kind: ErrorKind
  message: string
  // True when `message` is our own copy rather than the server's. Callers
  // that want to append a technical detail can check this instead of
  // guessing whether the string is already human-readable.
  rewritten: boolean
}

// PostgREST/GoTrue codes we can say something better about than the raw
// wire text. Anything not listed here keeps the server's own message.
const AUTH_CODES = new Set(['PGRST301', 'PGRST302'])
const PERMISSION_CODE = '42501'
const NOT_FOUND_CODE = 'PGRST116'

const NETWORK_MESSAGE_PATTERN =
  /failed to fetch|load failed|networkerror|network request failed|network error|fetch failed|err_internet_disconnected|signal timed out|the operation was aborted/i
// A request cut off by src/lib/supabase.ts's timeout arrives as a
// DOMException named TimeoutError (or AbortError); its `message` varies by
// browser, so the name is the reliable signal.
const ABORT_ERROR_NAMES = new Set(['TimeoutError', 'AbortError'])
const AUTH_MESSAGE_PATTERN =
  /jwt expired|jwt is expired|invalid jwt|jws?t.*(expired|invalid)|refresh token|session (has )?expired|not authenticated/i
const PERMISSION_MESSAGE_PATTERN =
  /row-level security|violates row-level security policy|permission denied|insufficient privilege/i

const COPY: Record<Exclude<ErrorKind, 'server' | 'unknown'>, string> = {
  offline: "You're offline. Reconnect and try again — nothing was saved.",
  network:
    "Couldn't reach the server. Check your connection and try again — nothing was saved.",
  auth: 'Your session expired. Sign in again to pick up where you left off.',
  permission: "You don't have permission to do that. Ask the organizer to check your access.",
  notFound: "That's no longer available — it may have been deleted or moved.",
}

function readString(source: unknown, key: string): string | null {
  if (!source || typeof source !== 'object') return null
  const value = (source as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : null
}

function readNumber(source: unknown, key: string): number | null {
  if (!source || typeof source !== 'object') return null
  const value = (source as Record<string, unknown>)[key]
  if (typeof value === 'number') return value
  // GoTrue reports `status` as a number but PostgREST sometimes stringifies
  // it, so accept a numeric string rather than missing a 401.
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return null
}

// Sorts a thrown value into a kind and the message a user should actually
// read. The rule is narrow on purpose: only the classes whose raw text is
// useless get rewritten. A PostgREST error carrying a real server message —
// an RPC `raise exception`, a check-constraint violation, "scoring is
// closed" — keeps that message verbatim, because the server knows why it
// said no and we don't.
export function classifyError(err: unknown, fallback: string): ClassifiedError {
  const message = readString(err, 'message')
  const code = readString(err, 'code')
  const status = readNumber(err, 'status')

  // Checked before anything else: when the browser knows the radio is off,
  // that's a better explanation than whatever the aborted fetch reported.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { kind: 'offline', message: COPY.offline, rewritten: true }
  }

  const name = readString(err, 'name')
  if (ABORT_ERROR_NAMES.has(name ?? '') || (message && NETWORK_MESSAGE_PATTERN.test(message))) {
    return { kind: 'network', message: COPY.network, rewritten: true }
  }

  if ((code && AUTH_CODES.has(code)) || status === 401 || (message && AUTH_MESSAGE_PATTERN.test(message))) {
    return { kind: 'auth', message: COPY.auth, rewritten: true }
  }

  if (code === PERMISSION_CODE || status === 403 || (message && PERMISSION_MESSAGE_PATTERN.test(message))) {
    return { kind: 'permission', message: COPY.permission, rewritten: true }
  }

  if (code === NOT_FOUND_CODE) {
    return { kind: 'notFound', message: COPY.notFound, rewritten: true }
  }

  // The server said something specific. Show it as-is.
  if (message) return { kind: 'server', message, rewritten: false }

  return { kind: 'unknown', message: fallback, rewritten: true }
}

// The app-wide entry point, kept at its original call signature so every
// existing `*-api.ts` re-export and catch block picks up the classification
// above without changing. Where a caller needs the kind as well (to choose
// a toast over inline text, say), it can call `classifyError` directly.
export function getErrorMessage(err: unknown, fallback: string): string {
  return classifyError(err, fallback).message
}
