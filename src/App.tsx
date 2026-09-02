import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { styled } from '../styled-system/jsx'
import { AuthProvider } from './features/auth/AuthProvider'
import { JoinPage } from './features/auth/JoinPage'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { SignUpPage } from './features/auth/SignUpPage'
import { LoadingScreen } from './features/auth/auth-ui'
import { useAuth } from './features/auth/useAuth'
import { EventDetailPage } from './features/events/EventDetailPage'
import { EventsListPage } from './features/events/EventsListPage'
import { NewEventPage } from './features/events/NewEventPage'
import { RoundsPage } from './features/rounds/RoundsPage'
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

function Home() {
  const { session, loading } = useAuth()

  if (loading) {
    return <LoadingScreen>Loading…</LoadingScreen>
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
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/events"
            element={
              <RequireAuth>
                <EventsListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/events/new"
            element={
              <RequireAuth>
                <NewEventPage />
              </RequireAuth>
            }
          />
          <Route
            path="/events/:eventId"
            element={
              <RequireAuth>
                <EventDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/events/:eventId/rounds"
            element={
              <RequireAuth>
                <RoundsPage />
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
