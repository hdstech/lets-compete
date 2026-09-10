import { useEffect, useState } from 'react'

// Mirrors Panda's `md` breakpoint. Below it the admin sidebar is an overlay
// drawer; at and above it the sidebar is persistent and collapses to an icon
// rail instead of disappearing.
const NARROW_VIEWPORT_QUERY = '(max-width: 767px)'

export function isNarrowViewport() {
  return window.matchMedia(NARROW_VIEWPORT_QUERY).matches
}

// CSS covers the layout half of that split, but the shell also has to make
// JS-side decisions from it — whether a collapsed sidebar should be marked
// inert, and whether its rows render as icons only — so the breakpoint has to
// be readable (and reactive) from React too.
export function useIsNarrowViewport() {
  const [narrow, setNarrow] = useState(isNarrowViewport)

  useEffect(() => {
    const query = window.matchMedia(NARROW_VIEWPORT_QUERY)
    function handleChange(event: MediaQueryListEvent) {
      setNarrow(event.matches)
    }

    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return narrow
}
