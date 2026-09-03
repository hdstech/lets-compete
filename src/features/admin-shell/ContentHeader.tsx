import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Breadcrumb, CollapseToggleButton, ContentHeaderRoot } from './admin-shell-ui'

type ContentHeaderProps = {
  breadcrumb: string
  collapsed: boolean
  onToggleCollapse: () => void
}

export function ContentHeader({ breadcrumb, collapsed, onToggleCollapse }: ContentHeaderProps) {
  return (
    <ContentHeaderRoot>
      <CollapseToggleButton
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </CollapseToggleButton>
      <Breadcrumb>{breadcrumb}</Breadcrumb>
    </ContentHeaderRoot>
  )
}
