import { useLocation } from 'react-router-dom'
import type { ComponentType } from 'react'
import { SidebarItemLabel, SidebarNavItemLink, SidebarNavRoot } from './admin-shell-ui'

export type NavItem = {
  to: string
  label: string
  icon: ComponentType<{ size?: number }>
}

export function SidebarNav({ items, railed }: { items: NavItem[]; railed: boolean }) {
  const location = useLocation()

  return (
    <SidebarNavRoot aria-label="Main">
      {items.map(({ to, label, icon: Icon }) => {
        const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`)
        return (
          <SidebarNavItemLink
            key={to}
            to={to}
            active={isActive}
            railed={railed}
            // The visible label is what names the link; once it is hidden the
            // icon needs to carry the name itself, and a tooltip to match.
            aria-label={railed ? label : undefined}
            title={railed ? label : undefined}
          >
            <Icon size={16} />
            <SidebarItemLabel railed={railed}>{label}</SidebarItemLabel>
          </SidebarNavItemLink>
        )
      })}
    </SidebarNavRoot>
  )
}
