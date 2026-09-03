import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { AuthForm, ErrorText, Field, Input, Label } from '../auth/auth-ui'
import { Button as SubmitButton } from '../../components/ui/Button'
import { Title as PageTitle } from '../../components/ui/Typography'
import { createEvent, getErrorMessage } from './events-api'
import {
  BackLink,
  Card,
  CheckboxField,
  HelpText,
  PageHeader,
  PageInner,
  PageShell,
  Row,
} from './events-ui'
import type { EventFormat } from './types'

export function NewEventPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [format, setFormat] = useState<EventFormat>('quiz')
  const [hasRounds, setHasRounds] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    setError(null)
    setSubmitting(true)

    try {
      const created = await createEvent({
        name,
        eventDate: eventDate || null,
        format,
        hasRounds,
        organizerId: user.id,
      })
      navigate(`/events/${created.id}`, { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create event'))
      setSubmitting(false)
    }
  }

  return (
    <PageShell>
      <PageInner>
        <PageHeader>
          <PageTitle>New event</PageTitle>
          <BackLink to="/events">Back to events</BackLink>
        </PageHeader>

        <Card>
          <AuthForm onSubmit={handleSubmit}>
            <Field>
              <Label htmlFor="name">Event name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>

            <Field>
              <Label htmlFor="event_date">Event date</Label>
              <Input
                id="event_date"
                name="event_date"
                type="date"
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
              />
            </Field>

            <Field>
              <Label htmlFor="format">Format</Label>
              <Row>
                <CheckboxField>
                  <input
                    type="radio"
                    name="format"
                    value="quiz"
                    checked={format === 'quiz'}
                    onChange={() => setFormat('quiz')}
                  />
                  Quiz / Bible Bowl
                </CheckboxField>
                <CheckboxField>
                  <input type="radio" name="format" value="judged" disabled />
                  Judged panel (coming in a future version)
                </CheckboxField>
              </Row>
              <HelpText>
                Format is permanent once the event is created.
              </HelpText>
            </Field>

            <Field>
              <CheckboxField>
                <input
                  type="checkbox"
                  checked={hasRounds}
                  onChange={(event) => setHasRounds(event.target.checked)}
                />
                This event has elimination rounds
              </CheckboxField>
            </Field>

            {error && <ErrorText role="alert">{error}</ErrorText>}
            <SubmitButton type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create event'}
            </SubmitButton>
          </AuthForm>
        </Card>
      </PageInner>
    </PageShell>
  )
}
