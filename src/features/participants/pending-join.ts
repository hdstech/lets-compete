import type { ParticipantType } from './types'

// JoinPage captures a join code + registration details before the OTP email
// is sent, then stashes them here — the magic-link click reloads the app at
// an unpredictable route (wherever Supabase's configured redirect lands),
// so App's top-level Home component is what actually calls join_event once
// a session shows up, not JoinPage itself.
const STORAGE_KEY = 'qb3.pendingJoin'

export type PendingJoin = {
  joinCode: string
  name: string
  type: ParticipantType
  members?: string
}

export function setPendingJoin(pending: PendingJoin): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
}

// Non-destructive presence check, safe to call during render (e.g. a
// useState lazy initializer) since it doesn't clear storage.
export function hasPendingJoin(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null
}

// Reads and clears in one step so a re-run effect (e.g. React StrictMode's
// double-invoke) can't submit the same join twice.
export function takePendingJoin(): PendingJoin | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  localStorage.removeItem(STORAGE_KEY)

  try {
    return JSON.parse(raw) as PendingJoin
  } catch {
    return null
  }
}
