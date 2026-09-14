import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Button as SubmitButton } from '../../components/ui/Button'
import {
  Subtitle as AuthSubtitle,
  Title as AuthTitle,
} from '../../components/ui/Typography'
import { supabase } from '../../lib/supabase'
import { AuthLayout } from './AuthLayout'
import {
  AuthFooterText,
  AuthForm,
  AuthLink,
  ErrorText,
  Field,
  Input,
  Label,
} from './auth-ui'
import { useAuth } from './useAuth'

export function JudgeSignInPage() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [linkSent, setLinkSent] = useState(false)

  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })

    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }

    setLinkSent(true)
  }

  if (linkSent) {
    return (
      <AuthLayout
        headline="Check your inbox."
        blurb="Your link signs you straight in — no password to remember, nothing to install."
      >
        <AuthTitle size="card">Check your email</AuthTitle>
        <AuthSubtitle>
          We sent a sign-in link to {email}. Open it on this device to continue —
          no password needed.
        </AuthSubtitle>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      headline="Ready to judge?"
      blurb="Judging an event? We'll email you a sign-in link."
    >
      <div>
        <AuthTitle size="card">Judge sign in</AuthTitle>
        <AuthSubtitle>
          Enter the email the organizer assigned to the event.
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
        <SubmitButton type="submit" size="lg" width="full" disabled={submitting}>
          {submitting ? 'Sending link…' : 'Email me a sign-in link'}
        </SubmitButton>
      </AuthForm>
      <AuthFooterText>
        Joining as a participant? <AuthLink to="/join">Use your join code</AuthLink>
      </AuthFooterText>
    </AuthLayout>
  )
}
