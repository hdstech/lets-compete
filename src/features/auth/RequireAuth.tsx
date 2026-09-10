import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { LoadingScreen } from './auth-ui'
import { Card } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingBlock } from '../../components/ui/LoadingBlock'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, sessionError, retrySession } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <LoadingScreen>
        <LoadingBlock />
      </LoadingScreen>
    )
  }

  // Deliberately ahead of the !session redirect: the bootstrap failing means
  // we don't know whether there's a session, and bouncing a participant to
  // /login mid-event over a dropped request would be a worse answer than
  // saying so and offering a retry.
  if (sessionError) {
    return (
      <LoadingScreen>
        <Card>
          <ErrorState message={sessionError} onRetry={retrySession} />
        </Card>
      </LoadingScreen>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
