import {
  SwitcherPlaceholderLabel,
  SwitcherPlaceholderName,
  SwitcherPlaceholderRoot,
} from './admin-shell-ui'

// Static stand-in until DS6 replaces this with the real, in-place-expanding
// events switcher ("+ Create event" and recent-events list).
export function SidebarSwitcherPlaceholder() {
  return (
    <SwitcherPlaceholderRoot>
      <SwitcherPlaceholderLabel>Workspace</SwitcherPlaceholderLabel>
      <SwitcherPlaceholderName>My Organization</SwitcherPlaceholderName>
    </SwitcherPlaceholderRoot>
  )
}
