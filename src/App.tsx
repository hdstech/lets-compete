import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { OfflineBanner } from './components/ui/OfflineBanner'
import { AdvancementPage } from './features/advancement/AdvancementPage'
import { AdminLayout } from './features/admin-shell/AdminLayout'
import { AuthProvider } from './features/auth/AuthProvider'
import { JoinPage } from './features/auth/JoinPage'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { SignUpPage } from './features/auth/SignUpPage'
import { EventDetailPage } from './features/events/EventDetailPage'
import { EventsListPage } from './features/events/EventsListPage'
import { NewEventPage } from './features/events/NewEventPage'
import { LandingPage } from './features/landing/LandingPage'
import { LiveAnswerPage } from './features/live-answer/LiveAnswerPage'
import { LiveConsolePage } from './features/live-quiz/LiveConsolePage'
import { WaitingRoomPage } from './features/participants/WaitingRoomPage'
import { QuestionsPage } from './features/questions/QuestionsPage'
import { ResultsHistoryPage } from './features/results/ResultsHistoryPage'
import { ResultsPage } from './features/results/ResultsPage'
import { RoundsPage } from './features/rounds/RoundsPage'
import { ScoringPage } from './features/scoring/ScoringPage'
import { DashboardPage } from './pages/DashboardPage'

function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
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
            <Route
              path="/events/:eventId/rounds/:roundId/segments/:segmentId/questions"
              element={<QuestionsPage />}
            />
            <Route path="/events/:eventId/results" element={<ResultsPage />} />
            <Route
              path="/events/:eventId/results/history"
              element={<ResultsHistoryPage />}
            />
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
            path="/events/:eventId/rounds/:roundId/score"
            element={
              <RequireAuth>
                <ScoringPage />
              </RequireAuth>
            }
          />
          <Route
            path="/events/:eventId/rounds/:roundId/advance"
            element={
              <RequireAuth>
                <AdvancementPage />
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
