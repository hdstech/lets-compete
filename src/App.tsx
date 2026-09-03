import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { styled } from '../styled-system/jsx'
import { AdminLayout } from './features/admin-shell/AdminLayout'
import { AuthProvider } from './features/auth/AuthProvider'
import { JoinPage } from './features/auth/JoinPage'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { SignUpPage } from './features/auth/SignUpPage'
import { ErrorText, LoadingScreen } from './features/auth/auth-ui'
import { useAuth } from './features/auth/useAuth'
import { EventDetailPage } from './features/events/EventDetailPage'
import { EventsListPage } from './features/events/EventsListPage'
import { NewEventPage } from './features/events/NewEventPage'
import { GradingPage } from './features/grading/GradingPage'
import { LiveAnswerPage } from './features/live-answer/LiveAnswerPage'
import { LiveConsolePage } from './features/live-quiz/LiveConsolePage'
import { WaitingRoomPage } from './features/participants/WaitingRoomPage'
import { getErrorMessage, joinEvent } from './features/participants/participants-api'
import { hasPendingJoin, takePendingJoin } from './features/participants/pending-join'
import { QuestionsPage } from './features/questions/QuestionsPage'
import { ResultsPage } from './features/results/ResultsPage'
import { RoundsPage } from './features/rounds/RoundsPage'
import { SegmentsPage } from './features/segments/SegmentsPage'
import { DashboardPage } from './pages/DashboardPage'

const HomeMain = styled('main', {
  base: {
    display: 'flex',
    minHeight: '100vh',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4',
    bg: 'slate.950',
    color: 'slate.100',
  },
})

const HomeHeading = styled('h1', {
  base: {
    fontSize: '2xl',
    fontWeight: 'semibold',
  },
})

const HomeNav = styled('nav', {
  base: {
    display: 'flex',
    gap: '4',
    fontSize: 'sm',
  },
})

const HomeLink = styled(Link, {
  base: {
    color: 'slate.100',
    textDecoration: 'underline',
  },
})

type JoinState = 'idle' | 'joining' | 'error'

function Home() {
  const { session, loading } = useAuth()
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
        {joinState === 'joining' ? 'Joining event…' : 'Loading…'}
      </LoadingScreen>
    )
  }

  if (joinState === 'error') {
    return (
      <HomeMain>
        <HomeHeading>Couldn't join the event</HomeHeading>
        <ErrorText role="alert">{joinError}</ErrorText>
        <HomeNav>
          <HomeLink to="/join">Try again</HomeLink>
          <HomeLink to="/dashboard">Continue to dashboard</HomeLink>
        </HomeNav>
      </HomeMain>
    )
  }

  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <HomeMain>
      <HomeHeading>Event Scoring App</HomeHeading>
      <HomeNav>
        <HomeLink to="/login">Organizer log in</HomeLink>
        <HomeLink to="/signup">Organizer sign up</HomeLink>
        <HomeLink to="/join">Join with email link</HomeLink>
      </HomeNav>
    </HomeMain>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/join" element={<JoinPage />} />
          <Route
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/events" element={<EventsListPage />} />
            <Route path="/events/new" element={<NewEventPage />} />
            <Route path="/events/:eventId" element={<EventDetailPage />} />
            <Route path="/events/:eventId/rounds" element={<RoundsPage />} />
          </Route>
          <Route
            path="/events/:eventId/waiting-room"
            element={
              <RequireAuth>
                <WaitingRoomPage />
              </RequireAuth>
            }
          />
          <Route
            path="/events/:eventId/play"
            element={
              <RequireAuth>
                <LiveAnswerPage />
              </RequireAuth>
            }
          />
          <Route
            path="/events/:eventId/rounds/:roundId/live"
            element={
              <RequireAuth>
                <LiveConsolePage />
              </RequireAuth>
            }
          />
          <Route
            path="/events/:eventId/rounds/:roundId/grade"
            element={
              <RequireAuth>
                <GradingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/events/:eventId/rounds/:roundId/segments"
            element={
              <RequireAuth>
                <SegmentsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/events/:eventId/rounds/:roundId/segments/:segmentId/questions"
            element={
              <RequireAuth>
                <QuestionsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/events/:eventId/results"
            element={
              <RequireAuth>
                <ResultsPage />
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
