import type { ReactNode } from 'react'
import { SidebarShellRoot } from './admin-shell-ui'

export function SidebarShell({ children }: { children: ReactNode }) {
  return <SidebarShellRoot>{children}</SidebarShellRoot>
}
