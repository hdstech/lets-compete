import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from './useAuth'
import {
  AuthCard,
  AuthFooterText,
  AuthForm,
  AuthLink,
  AuthShell,
  AuthSubtitle,
  AuthTitle,
  ErrorText,
  Field,
  Input,
  Label,
  SubmitButton,
} from './auth-ui'

type LocationState = { from?: { pathname: string } }

export const LoginPage = () => {
  const { session } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) {
    const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? '/dashboard'
    return <Navigate to={redirectTo} replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }

    const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? '/dashboard'
    navigate(redirectTo, { replace: true })
  }

  return (
    <AuthShell>
      <AuthCard>
        <div>
          <AuthTitle>Log in</AuthTitle>
          <AuthSubtitle>Sign in to manage or join an event.</AuthSubtitle>
        </div>
        <AuthForm onSubmit={handleSubmit}>
          <Field>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          {error && <ErrorText role="alert">{error}</ErrorText>}
          <SubmitButton type="submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </SubmitButton>
        </AuthForm>
        <AuthFooterText>
          Need an account? <AuthLink to="/signup">Sign up</AuthLink>
        </AuthFooterText>
      </AuthCard>
    </AuthShell>
  )
}
