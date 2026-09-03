import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from './useAuth'
import {
  AuthCard,
  AuthFooterText,
  AuthForm,
  AuthLink,
  AuthShell,
  ErrorText,
  Field,
  Input,
  Label,
} from './auth-ui'
import { Button as SubmitButton } from '../../components/ui/Button'
import {
  Title as AuthTitle,
  Subtitle as AuthSubtitle,
} from '../../components/ui/Typography'
import { CheckboxField, Row } from '../events/events-ui'
import { setPendingJoin } from '../participants/pending-join'
import type { ParticipantType } from '../participants/types'

export function JoinPage() {
  const { session } = useAuth()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState('')
  const [joinCode, setJoinCode] = useState(searchParams.get('code') ?? '')
  const [name, setName] = useState('')
  const [type, setType] = useState<ParticipantType>('individual')
  const [members, setMembers] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [linkSent, setLinkSent] = useState(false)

  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  const wantsToJoin = joinCode.trim() !== ''

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (wantsToJoin && name.trim() === '') {
      setError('Enter your name to join with a code.')
      return
    }

    setSubmitting(true)

    if (wantsToJoin) {
      setPendingJoin({
        joinCode: joinCode.trim(),
        name: name.trim(),
        type,
        members: type === 'team' ? members.trim() || undefined : undefined,
      })
    }

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
            We sent a sign-in link to {email}. Open it on this device to
            continue — no password needed.
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
            Participants and graders sign in with an emailed link — no password
            needed.
          </AuthSubtitle>
        </div>
        <AuthForm onSubmit={handleSubmit}>
          <Field>
            <Label htmlFor="joinCode">Join code (participants only)</Label>
            <Input
              id="joinCode"
              name="joinCode"
              type="text"
              autoComplete="off"
              placeholder="Leave blank if you're a grader"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
            />
          </Field>

          {wantsToJoin && (
            <>
              <Field>
                <Label htmlFor="name">Your name</Label>
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
                <Label>Registering as</Label>
                <Row>
                  <CheckboxField>
                    <input
                      type="radio"
                      name="participant_type"
                      checked={type === 'individual'}
                      onChange={() => setType('individual')}
                    />
                    Individual
                  </CheckboxField>
                  <CheckboxField>
                    <input
                      type="radio"
                      name="participant_type"
                      checked={type === 'team'}
                      onChange={() => setType('team')}
                    />
                    Team
                  </CheckboxField>
                </Row>
              </Field>

              {type === 'team' && (
                <Field>
                  <Label htmlFor="members">Team members</Label>
                  <Input
                    id="members"
                    name="members"
                    type="text"
                    value={members}
                    onChange={(event) => setMembers(event.target.value)}
                  />
                </Field>
              )}
            </>
          )}

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
          Organizing an event?{' '}
          <AuthLink to="/login">Log in with a password</AuthLink>
        </AuthFooterText>
      </AuthCard>
    </AuthShell>
  )
}
