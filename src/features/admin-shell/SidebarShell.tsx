import type { ReactNode } from 'react'
import { SidebarShellRoot } from './admin-shell-ui'

export function SidebarShell({
  children,
  collapsed,
}: {
  children: ReactNode
  collapsed: boolean
}) {
  return (
    <SidebarShellRoot collapsed={collapsed} inert={collapsed}>
      {children}
    </SidebarShellRoot>
  )
}
