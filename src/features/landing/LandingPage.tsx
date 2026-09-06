import { useEffect, useState } from 'react'
import { ArrowRight, Moon, Sun, Trophy, Users, Zap } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { LoadingBlock } from '../../components/ui/LoadingBlock'
import { LinkButton } from '../../components/ui/Button'
import { Title } from '../../components/ui/Typography'
import {
  AuthCard,
  AuthLink,
  AuthShell,
  ErrorText,
  LoadingScreen,
} from '../auth/auth-ui'
import { useAuth } from '../auth/useAuth'
import { getErrorMessage, joinEvent } from '../participants/participants-api'
import { hasPendingJoin, takePendingJoin } from '../participants/pending-join'
import { useTheme } from '../theme/useTheme'
import { LiveStandings } from './LiveStandings'
import {
  ActionBody,
  ActionHeading,
  ActionPanel,
  ActionText,
  BrandGlow,
  BrandGrid,
  BrandHeadline,
  BrandPanel,
  BrandTagline,
  CtaRow,
  Eyebrow,
  FeatureCard,
  FeatureGrid,
  FeatureIcon,
  InlineLink,
  LandingRoot,
  SecondaryLinks,
  ThemeToggle,
  Wordmark,
  WordmarkBadge,
} from './landing-ui'

type JoinState = 'idle' | 'joining' | 'error'

const FEATURES = [
  { id: 'live', icon: Zap, label: 'Live scoring' },
  { id: 'teams', icon: Users, label: 'Teams or solo' },
  { id: 'standings', icon: Trophy, label: 'Instant standings' },
]

export function LandingPage() {
  const { session, loading } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  // Read synchronously at mount (not via an effect) so the very first render
  // already knows whether to show the marketing page or a "joining" state —
  // this is what lets the effect below only ever call setState from inside
  // an async callback, never directly in the effect body.
  const [joinState, setJoinState] = useState<JoinState>(() =>
    hasPendingJoin() ? 'joining' : 'idle',
  )
  const [joinError, setJoinError] = useState<string | null>(null)

  // A magic-link click reloads the app here regardless of which page sent
  // the OTP email, so this is the one place that can pick up a pending
  // participant join (stashed by JoinPage) once a session actually exists.
  useEffect(() => {
    if (loading || !session || joinState !== 'joining') return

    const pending = takePendingJoin()
    if (!pending) return

    joinEvent(pending.joinCode, pending.name, pending.type, pending.members)
      .then((participant) => {
        navigate(`/events/${participant.event_id}/waiting-room`, { replace: true })
      })
      .catch((err) => {
        setJoinError(getErrorMessage(err, 'Failed to join the event'))
        setJoinState('error')
      })
  }, [session, loading, joinState, navigate])

  if (loading || joinState === 'joining') {
    return (
      <LoadingScreen>
        <LoadingBlock label={joinState === 'joining' ? 'Joining event…' : 'Loading…'} />
      </LoadingScreen>
    )
  }

  if (joinState === 'error') {
    return (
      <AuthShell>
        <AuthCard>
          <Title>Couldn't join the event</Title>
          <ErrorText role="alert">{joinError}</ErrorText>
          <SecondaryLinks>
            <AuthLink to="/join">Try again</AuthLink>
            <AuthLink to="/dashboard">Continue to dashboard</AuthLink>
          </SecondaryLinks>
        </AuthCard>
      </AuthShell>
    )
  }

  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <LandingRoot>
      <BrandPanel>
        <BrandGlow placement="top" />
        <BrandGlow placement="bottom" />
        <BrandGrid />

        <Wordmark>
          <WordmarkBadge>
            <Trophy size={18} aria-hidden="true" />
          </WordmarkBadge>
          Event Scoring App
        </Wordmark>

        <div>
          <BrandHeadline>Let's Compete</BrandHeadline>
          <BrandTagline>
            Quiz nights, tournaments, class showdowns. Build the rounds, let
            everyone in from their own phone, and watch the leaderboard move as
            the points land.
          </BrandTagline>
        </div>

        <LiveStandings />
      </BrandPanel>

      <ActionPanel>
        <ThemeToggle
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </ThemeToggle>

        <ActionBody>
          <Eyebrow>Set up in minutes</Eyebrow>
          <ActionHeading>Ready when you are.</ActionHeading>
          <ActionText>
            Organizers build the rounds and run the show. Players and judges
            join from any phone — nothing to install, nothing to hand out but a
            link.
          </ActionText>

          <CtaRow>
            <LinkButton to="/login" size="lg">
              Let's get started
              <ArrowRight size={18} aria-hidden="true" />
            </LinkButton>
          </CtaRow>

          <SecondaryLinks>
            <span>
              New here? <InlineLink to="/signup">Organizer sign up</InlineLink>
            </span>
            <span>
              Joining an event?{' '}
              <InlineLink to="/join">Use your email link</InlineLink>
            </span>
          </SecondaryLinks>

          <FeatureGrid>
            {FEATURES.map(({ id, icon: Icon, label }) => (
              <FeatureCard key={id}>
                <FeatureIcon>
                  <Icon size={16} aria-hidden="true" />
                </FeatureIcon>
                {label}
              </FeatureCard>
            ))}
          </FeatureGrid>
        </ActionBody>
      </ActionPanel>
    </LandingRoot>
  )
}
