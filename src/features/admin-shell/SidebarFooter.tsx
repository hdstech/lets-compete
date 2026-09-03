import { LogOut, Moon, Sun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useTheme } from '../theme/useTheme'
import { SidebarFooterButton, SidebarFooterRoot } from './admin-shell-ui'

export function SidebarFooter() {
  const { theme, toggleTheme } = useTheme()
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <SidebarFooterRoot>
      <SidebarFooterButton
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        {theme === 'dark' ? 'Light mode' : 'Dark mode'}
      </SidebarFooterButton>
      <SidebarFooterButton type="button" onClick={handleSignOut}>
        <LogOut size={16} />
        Log out
      </SidebarFooterButton>
    </SidebarFooterRoot>
  )
}
