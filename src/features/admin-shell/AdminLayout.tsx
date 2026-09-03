import { Calendar, Home } from 'lucide-react'
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import {
  AdminShellRoot,
  ContentArea,
  PageOutletWrapper,
  SidebarBackdrop,
} from './admin-shell-ui'
import { ContentHeader } from './ContentHeader'
import { SidebarFooter } from './SidebarFooter'
import type { NavItem } from './SidebarNav'
import { SidebarNav } from './SidebarNav'
import { SidebarShell } from './SidebarShell'
import { SidebarSwitcher } from './SidebarSwitcher'

// Mirrors the app's current top-level authenticated routes (src/App.tsx).
// DS9 is responsible for wiring this layout into the router; until then it
// renders standalone, so this list may need to be revisited there.
const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: Home },
  { to: '/events', label: 'Events', icon: Calendar },
]

function isNarrowViewport() {
  return window.matchMedia('(max-width: 767px)').matches
}

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(isNarrowViewport)
  const location = useLocation()
  const [collapsedForPath, setCollapsedForPath] = useState(location.pathname)
  if (location.pathname !== collapsedForPath) {
    setCollapsedForPath(location.pathname)
    if (isNarrowViewport()) setCollapsed(true)
  }

  const breadcrumb =
    NAV_ITEMS.find((item) => location.pathname.startsWith(item.to))?.label ?? 'Admin'

  return (
    <AdminShellRoot>
      {!collapsed && (
        <>
          <SidebarBackdrop
            type="button"
            aria-label="Dismiss sidebar"
            onClick={() => setCollapsed(true)}
          />
          <SidebarShell>
            <SidebarSwitcher />
            <SidebarNav items={NAV_ITEMS} />
            <SidebarFooter />
          </SidebarShell>
        </>
      )}
      <ContentArea>
        <ContentHeader
          breadcrumb={breadcrumb}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((prev) => !prev)}
        />
        <PageOutletWrapper>
          <Outlet />
        </PageOutletWrapper>
      </ContentArea>
    </AdminShellRoot>
  )
}
