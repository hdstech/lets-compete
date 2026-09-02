import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
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

export const SignUpPage = () => {
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

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
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
      <AuthShell>
        <AuthCard>
          <AuthTitle>Check your email</AuthTitle>
          <AuthSubtitle>
            We sent a confirmation link to {email}. Confirm your address, then{' '}
            <AuthLink to="/login">log in</AuthLink>.
          </AuthSubtitle>
        </AuthCard>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <AuthCard>
        <div>
          <AuthTitle>Organizer sign up</AuthTitle>
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
          <SubmitButton type="submit" disabled={submitting}>
            {submitting ? 'Signing up…' : 'Sign up'}
          </SubmitButton>
        </AuthForm>
        <AuthFooterText>
          Already have an account? <AuthLink to="/login">Log in</AuthLink>
        </AuthFooterText>
        <AuthFooterText>
          Participant or grader? <AuthLink to="/join">Use your email link</AuthLink>
        </AuthFooterText>
      </AuthCard>
    </AuthShell>
  )
}
