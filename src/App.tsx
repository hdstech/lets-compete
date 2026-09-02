import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { styled } from '../styled-system/jsx'
import { AuthProvider } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { SignUpPage } from './features/auth/SignUpPage'
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
  return (
    <HomeMain>
      <HomeHeading>Event Scoring App</HomeHeading>
      <HomeNav>
        <HomeLink to="/login">Log in</HomeLink>
        <HomeLink to="/signup">Sign up</HomeLink>
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
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
