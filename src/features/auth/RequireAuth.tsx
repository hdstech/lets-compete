import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { LoadingScreen } from './auth-ui'

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingScreen>Loading…</LoadingScreen>
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
