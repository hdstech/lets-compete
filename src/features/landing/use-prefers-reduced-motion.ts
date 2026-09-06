import { useEffect, useState } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

// CSS handles the decorative animations via Panda's `_motionReduce`, but the
// landing page also drives a timer-based demo in JS — that has to be switched
// off in the same breath, otherwise reduced-motion visitors get content
// silently rearranging itself with no transition to explain the change.
export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
  )

  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    function handleChange(event: MediaQueryListEvent) {
      setPrefersReducedMotion(event.matches)
    }

    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return prefersReducedMotion
}
