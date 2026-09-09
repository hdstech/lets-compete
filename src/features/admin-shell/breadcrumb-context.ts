import { createContext } from 'react'

// A single step in the content-header breadcrumb trail. A crumb with a `to`
// is a link back to that screen; the trailing crumb (the current screen) is
// rendered as plain text regardless.
export type Crumb = { label: string; to?: string }

export type BreadcrumbContextValue = {
  crumbs: Crumb[]
  setCrumbs: (crumbs: Crumb[]) => void
  dirty: boolean
  setDirty: (dirty: boolean) => void
}

// Shared state between the content header (which renders the trail and guards
// navigation) and the page currently mounted in the outlet (which supplies
// the trail and reports whether it holds unsaved form data).
export const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(
  null,
)
