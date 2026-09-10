import type { ReactNode } from 'react'
import { SidebarShellRoot } from './admin-shell-ui'

export function SidebarShell({
  children,
  collapsed,
  inert,
}: {
  children: ReactNode
  collapsed: boolean
  // Only the phone drawer is taken out of the interaction order when closed —
  // the desktop rail stays fully operable while collapsed.
  inert: boolean
}) {
  return (
    <SidebarShellRoot collapsed={collapsed} inert={inert}>
      {children}
    </SidebarShellRoot>
  )
}
