import { Calendar, Home, PanelLeftClose, PanelLeftOpen, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import {
  AdminShellRoot,
  ContentArea,
  PageOutletWrapper,
  SidebarBackdrop,
  SidebarBrandLink,
  SidebarBrandMark,
  SidebarCollapseButton,
  SidebarHeaderRow,
  SidebarItemLabel,
} from './admin-shell-ui'
import { BreadcrumbProvider } from './BreadcrumbProvider'
import { ContentHeader } from './ContentHeader'
import type { BreadcrumbSection } from './ContentHeader'
import { SidebarFooter } from './SidebarFooter'
import type { NavItem } from './SidebarNav'
import { SidebarNav } from './SidebarNav'
import { SidebarShell } from './SidebarShell'
import { SidebarSwitcher } from './SidebarSwitcher'
import { isNarrowViewport, useIsNarrowViewport } from './use-narrow-viewport'

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

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(isNarrowViewport)
  const narrow = useIsNarrowViewport()
  const location = useLocation()
  const [collapsedForPath, setCollapsedForPath] = useState(location.pathname)
  if (location.pathname !== collapsedForPath) {
    setCollapsedForPath(location.pathname)
    if (isNarrowViewport()) setCollapsed(true)
  }

  // Collapsed reads differently by breakpoint: a closed phone drawer is gone
  // (and inert), while a collapsed desktop panel is an icon rail that stays
  // on screen and keeps working.
  const railed = collapsed && !narrow

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
        <SidebarShell collapsed={collapsed} inert={collapsed && narrow}>
          <SidebarHeaderRow railed={railed}>
            <SidebarBrandLink to="/dashboard" aria-label="Let's Compete">
              <SidebarBrandMark>
                <Trophy size={16} aria-hidden="true" />
              </SidebarBrandMark>
              <SidebarItemLabel railed={railed}>Let's Compete</SidebarItemLabel>
            </SidebarBrandLink>
            <SidebarCollapseButton
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </SidebarCollapseButton>
          </SidebarHeaderRow>
          <SidebarSwitcher railed={railed} onExpandSidebar={() => setCollapsed(false)} />
          <SidebarNav items={NAV_ITEMS} railed={railed} />
          <SidebarFooter railed={railed} />
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
