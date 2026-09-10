import { LogOut, Moon, Sun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useTheme } from '../theme/useTheme'
import { SidebarFooterButton, SidebarFooterRoot, SidebarItemLabel } from './admin-shell-ui'

export function SidebarFooter({ railed }: { railed: boolean }) {
  const { theme, toggleTheme } = useTheme()
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
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
