import { Calendar, Home, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import {
  AdminShellRoot,
  ContentArea,
  PageOutletWrapper,
  SidebarBackdrop,
  SidebarBrandLink,
  SidebarBrandMark,
} from './admin-shell-ui'
import { BreadcrumbProvider } from './BreadcrumbProvider'
import { ContentHeader } from './ContentHeader'
import type { BreadcrumbSection } from './ContentHeader'
import { SidebarFooter } from './SidebarFooter'
import type { NavItem } from './SidebarNav'
import { SidebarNav } from './SidebarNav'
import { SidebarShell } from './SidebarShell'
import { SidebarSwitcher } from './SidebarSwitcher'

// Mirrors the app's current top-level authenticated routes (src/App.tsx).
const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: Home },
  { to: '/events', label: 'Events', icon: Calendar },
]

const OVERVIEW_SECTION: BreadcrumbSection = {
  label: 'Overview',
  to: '/dashboard',
  icon: Home,
}
const EVENTS_SECTION: BreadcrumbSection = {
  label: 'Events',
  to: '/events',
  icon: Calendar,
}

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

  // The breadcrumb root is the section-level icon; pages fill in the trail
  // after it. Everything outside the dashboard lives under the Events section.
  const section = location.pathname.startsWith('/dashboard')
    ? OVERVIEW_SECTION
    : EVENTS_SECTION

  return (
    <BreadcrumbProvider>
      <AdminShellRoot>
        <SidebarBackdrop
          type="button"
          aria-label="Dismiss sidebar"
          visible={!collapsed}
          inert={collapsed}
          onClick={() => setCollapsed(true)}
        />
        <SidebarShell collapsed={collapsed}>
          <SidebarBrandLink to="/dashboard">
            <SidebarBrandMark>
              <Trophy size={16} aria-hidden="true" />
            </SidebarBrandMark>
            Let's Compete
          </SidebarBrandLink>
          <SidebarSwitcher />
          <SidebarNav items={NAV_ITEMS} />
          <SidebarFooter />
        </SidebarShell>
        <ContentArea>
          <ContentHeader
            section={section}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((prev) => !prev)}
          />
          <PageOutletWrapper>
            <Outlet />
          </PageOutletWrapper>
        </ContentArea>
      </AdminShellRoot>
    </BreadcrumbProvider>
  )
}
