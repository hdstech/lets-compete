import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  /**
   * Set when the session bootstrap itself failed, as opposed to succeeding
   * with no session. Consumers must treat this as "we don't know who you
   * are", not as "you're signed out" — bouncing to /login on a transient
   * network failure would log a working session out of a live event.
   */
  sessionError: string | null
  retrySession: () => void
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
