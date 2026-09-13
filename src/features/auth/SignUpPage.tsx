import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { useAuth } from './useAuth'
import {
  AuthFooterText,
  AuthForm,
  AuthLink,
  ErrorText,
  Field,
  Input,
  Label,
} from './auth-ui'
import { AuthLayout } from './AuthLayout'
import { Button as SubmitButton } from '../../components/ui/Button'
import {
  Title as AuthTitle,
  Subtitle as AuthSubtitle,
} from '../../components/ui/Typography'

const SIGNUP_FAILED = 'Could not create your account. Please try again.'

export function SignUpPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      // Organizer accounts are created by our own server route rather than
      // supabase.auth.signUp, because only the server can set
      // profiles.is_organizer (QA19). The route creates the account already
      // confirmed, so signing straight in afterwards always works.
      const res = await fetch('/api/organizer-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? SIGNUP_FAILED)
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(signInError.message)
        return
      }
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, SIGNUP_FAILED))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      headline="Let's Compete"
      blurb="Create an organizer account to build rounds, invite players, and run the whole night from one screen."
    >
      <div>
        <AuthTitle size="card">Organizer sign up</AuthTitle>
        <AuthSubtitle>Create an account to organize and run events.</AuthSubtitle>
      </div>
      <AuthForm onSubmit={handleSubmit}>
        <Field>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
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
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {error && <ErrorText role="alert">{error}</ErrorText>}
        <SubmitButton type="submit" size="lg" width="full" disabled={submitting}>
          {submitting ? 'Signing up…' : 'Sign up'}
        </SubmitButton>
      </AuthForm>
      <AuthFooterText>
        Already have an account? <AuthLink to="/login">Log in</AuthLink>
      </AuthFooterText>
      <AuthFooterText>
        Participant or judge? <AuthLink to="/join">Use your email link</AuthLink>
      </AuthFooterText>
    </AuthLayout>
  )
}
