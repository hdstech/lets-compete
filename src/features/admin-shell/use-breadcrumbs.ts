import { useContext, useEffect } from 'react'
import { BreadcrumbContext } from './breadcrumb-context'
import type { BreadcrumbContextValue, Crumb } from './breadcrumb-context'

function useBreadcrumbContext(): BreadcrumbContextValue {
  const ctx = useContext(BreadcrumbContext)
  if (!ctx) {
    throw new Error('Breadcrumb hooks must be used within a BreadcrumbProvider')
  }
  return ctx
}

// Consumed by the content header to render the trail and drive the
// unsaved-changes guard.
export function useBreadcrumbState(): BreadcrumbContextValue {
  return useBreadcrumbContext()
}

// Called by a page to publish its breadcrumb trail (the crumbs after the
// section-icon root). The trail is cleared when the page unmounts so the next
// screen starts from a clean slate.
export function usePageBreadcrumbs(crumbs: Crumb[]) {
  const { setCrumbs } = useBreadcrumbContext()
  const serialized = JSON.stringify(crumbs)

  useEffect(() => {
    setCrumbs(crumbs)
    return () => setCrumbs([])
    // `serialized` captures the crumbs' contents so the effect re-runs when a
    // label or link changes (e.g. once an event's name loads).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, setCrumbs])
}

// Called by a page to report whether it currently holds unsaved form data, so
// breadcrumb navigation can warn before discarding it. Registration is
// cleared on unmount.
export function useUnsavedChanges(isDirty: boolean) {
  const { setDirty } = useBreadcrumbContext()

  useEffect(() => {
    setDirty(isDirty)
    return () => setDirty(false)
  }, [isDirty, setDirty])
}
