import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getErrorMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  const retrySession = useCallback(() => {
    setSessionError(null)
    setLoading(true)
    setRetryToken((token) => token + 1)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return
        // getSession resolves with an `error` rather than rejecting when the
        // stored session can't be refreshed, so both have to be handled or
        // the app signs the user out on a blip.
        if (error) {
          setSessionError(getErrorMessage(error, "Couldn't restore your session."))
        } else {
          setSession(data.session)
        }
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!active) return
        // Without this, a rejected getSession left `loading` true forever and
        // every guarded route sat on a spinner with no message and no way
        // out — the app's longest-lived silent failure.
        setSessionError(getErrorMessage(err, "Couldn't restore your session."))
        setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // A later successful auth event supersedes an earlier bootstrap
      // failure — the session is known again.
      setSessionError(null)
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [retryToken])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      sessionError,
      retrySession,
      async signOut() {
        const { error } = await supabase.auth.signOut()
        // Local state is cleared either way (onAuthStateChange fires), but
        // throwing lets the caller tell the user the server-side sign-out
        // didn't land rather than silently implying it did.
        if (error) throw error
      },
    }),
    [session, loading, sessionError, retrySession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
