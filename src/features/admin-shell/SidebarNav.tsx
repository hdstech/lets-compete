import { useLocation } from 'react-router-dom'
import type { ComponentType } from 'react'
import { SidebarNavItemLink, SidebarNavRoot } from './admin-shell-ui'

export type NavItem = {
  to: string
  label: string
  icon: ComponentType<{ size?: number }>
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const location = useLocation()

  return (
    <SidebarNavRoot aria-label="Main">
      {items.map(({ to, label, icon: Icon }) => {
        const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`)
        return (
          <SidebarNavItemLink key={to} to={to} active={isActive}>
            <Icon size={16} />
            {label}
          </SidebarNavItemLink>
        )
      })}
    </SidebarNavRoot>
  )
}
