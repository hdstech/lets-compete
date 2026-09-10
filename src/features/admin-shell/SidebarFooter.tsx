import { LogOut, Moon, Sun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../../lib/errors'
import { useToast } from '../../components/ui/useToast'
import { useAuth } from '../auth/useAuth'
import { useTheme } from '../theme/useTheme'
import { SidebarFooterButton, SidebarFooterRoot, SidebarItemLabel } from './admin-shell-ui'

export function SidebarFooter({ railed }: { railed: boolean }) {
  const { theme, toggleTheme } = useTheme()
  const { signOut } = useAuth()
  const { showError } = useToast()
  const navigate = useNavigate()

  async function handleSignOut() {
    try {
      await signOut()
    } catch (err) {
      // The local session is cleared regardless, so still leave for /login —
      // but say that the server-side sign-out didn't land, since on a shared
      // machine that's the difference between signed out and only appearing
      // to be.
      showError(
        `Signed out on this device, but the server didn't confirm it. ${getErrorMessage(err, 'Sign out again once you have a connection.')}`,
        { key: 'sign-out' },
      )
    }
    navigate('/login', { replace: true })
  }

  const themeLabel = theme === 'dark' ? 'Light mode' : 'Dark mode'

  return (
    <SidebarFooterRoot>
      <SidebarFooterButton
        type="button"
        railed={railed}
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={railed ? themeLabel : undefined}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        <SidebarItemLabel railed={railed}>{themeLabel}</SidebarItemLabel>
      </SidebarFooterButton>
      <SidebarFooterButton
        type="button"
        railed={railed}
        onClick={handleSignOut}
        aria-label={railed ? 'Log out' : undefined}
        title={railed ? 'Log out' : undefined}
      >
        <LogOut size={16} />
        <SidebarItemLabel railed={railed}>Log out</SidebarItemLabel>
      </SidebarFooterButton>
    </SidebarFooterRoot>
  )
}
