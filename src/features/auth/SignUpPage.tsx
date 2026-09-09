import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
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

export function SignUpPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })

    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }

    if (data.session) {
      navigate('/dashboard', { replace: true })
      return
    }

    // Email confirmation is enabled on this project — no session yet.
    setConfirmationSent(true)
  }

  if (confirmationSent) {
    return (
      <AuthLayout
        headline="One click away."
        blurb="Confirm your address and your organizer account is ready to run its first event."
      >
        <AuthTitle size="card">Check your email</AuthTitle>
        <AuthSubtitle>
          We sent a confirmation link to {email}. Confirm your address, then{' '}
          <AuthLink to="/login">log in</AuthLink>.
        </AuthSubtitle>
      </AuthLayout>
    )
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
