import { useNavigate } from 'react-router-dom'
import { styled } from '../../styled-system/jsx'
import { useAuth } from '../features/auth/useAuth'

const DashboardMain = styled('main', {
  base: {
    display: 'flex',
    minHeight: '100vh',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3',
    bg: 'slate.950',
    color: 'slate.100',
    px: '4',
  },
})

const DashboardHeading = styled('h1', {
  base: {
    fontSize: 'xl',
    fontWeight: 'semibold',
  },
})

const DashboardText = styled('p', {
  base: {
    fontSize: 'sm',
    color: 'slate.400',
  },
})

const SignOutButton = styled('button', {
  base: {
    mt: '4',
    bg: 'slate.100',
    color: 'slate.950',
    borderRadius: 'md',
    px: '4',
    py: '2',
    fontSize: 'sm',
    fontWeight: 'semibold',
    cursor: 'pointer',
  },
})

export function DashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <DashboardMain>
      <DashboardHeading>
        {user?.user_metadata.name ? `Welcome, ${user.user_metadata.name}` : 'Welcome'}
      </DashboardHeading>
      <DashboardText>{user?.email}</DashboardText>
      <SignOutButton type="button" onClick={handleSignOut}>
        Sign out
      </SignOutButton>
    </DashboardMain>
  )
}
