import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { ComponentType, MouseEvent } from 'react'
import { Fragment, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import {
  BreadcrumbCurrent,
  BreadcrumbIconLink,
  BreadcrumbLink,
  BreadcrumbNav,
  BreadcrumbSeparator,
  CollapseToggleButton,
  ContentHeaderRoot,
} from './admin-shell-ui'
import { useBreadcrumbState } from './use-breadcrumbs'

export type BreadcrumbSection = {
  label: string
  to: string
  icon: ComponentType<{ size?: number }>
}

type ContentHeaderProps = {
  section: BreadcrumbSection
  collapsed: boolean
  onToggleCollapse: () => void
}

export function ContentHeader({
  section,
  collapsed,
  onToggleCollapse,
}: ContentHeaderProps) {
  const { crumbs, dirty, setDirty } = useBreadcrumbState()
  const navigate = useNavigate()
  const [pendingTo, setPendingTo] = useState<string | null>(null)

  // When the current screen holds unsaved form data, intercept a breadcrumb
  // link so we can warn before discarding it, and navigate only on confirm.
  function handleNavigate(event: MouseEvent, to: string) {
    if (!dirty) return
    event.preventDefault()
    setPendingTo(to)
  }

  const SectionIcon = section.icon

  return (
    <ContentHeaderRoot>
      <CollapseToggleButton
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </CollapseToggleButton>

      <BreadcrumbNav aria-label="Breadcrumb">
        <BreadcrumbIconLink
          to={section.to}
          aria-label={section.label}
          onClick={(e) => handleNavigate(e, section.to)}
        >
          <SectionIcon size={16} />
        </BreadcrumbIconLink>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              <BreadcrumbSeparator aria-hidden="true">/</BreadcrumbSeparator>
              {crumb.to && !isLast ? (
                <BreadcrumbLink
                  to={crumb.to}
                  onClick={(e) => handleNavigate(e, crumb.to!)}
                >
                  {crumb.label}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbCurrent aria-current={isLast ? 'page' : undefined}>
                  {crumb.label}
                </BreadcrumbCurrent>
              )}
            </Fragment>
          )
        })}
      </BreadcrumbNav>

      <ConfirmDialog
        open={pendingTo !== null}
        title="Unsaved changes"
        description="You have unsaved changes on this screen. Leave now and lose them, or stay to finish?"
        confirmLabel="Leave and lose changes"
        tone="danger"
        onConfirm={() => {
          const to = pendingTo
          setPendingTo(null)
          setDirty(false)
          if (to) navigate(to)
        }}
        onCancel={() => setPendingTo(null)}
      />
    </ContentHeaderRoot>
  )
}
