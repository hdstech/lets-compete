import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Navigate } from 'react-router-dom'
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

export const JoinPage = () => {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [linkSent, setLinkSent] = useState(false)

  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error } = await supabase.auth.signInWithOtp({ email })

    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }

    setLinkSent(true)
  }

  if (linkSent) {
    return (
      <AuthShell>
        <AuthCard>
          <AuthTitle>Check your email</AuthTitle>
          <AuthSubtitle>
            We sent a sign-in link to {email}. Open it on this device to continue — no password
            needed.
          </AuthSubtitle>
        </AuthCard>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <AuthCard>
        <div>
          <AuthTitle>Join an event</AuthTitle>
          <AuthSubtitle>
            Participants and graders sign in with an emailed link — no password needed.
          </AuthSubtitle>
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
          {error && <ErrorText role="alert">{error}</ErrorText>}
          <SubmitButton type="submit" disabled={submitting}>
            {submitting ? 'Sending link…' : 'Email me a sign-in link'}
          </SubmitButton>
        </AuthForm>
        <AuthFooterText>
          Organizing an event? <AuthLink to="/login">Log in with a password</AuthLink>
        </AuthFooterText>
      </AuthCard>
    </AuthShell>
  )
}
