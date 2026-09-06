import { useEffect, useState } from 'react'
import { styled } from '../../../styled-system/jsx'

const Banner = styled('div', {
  base: {
    position: 'fixed',
    top: '0',
    insetInline: '0',
    zIndex: '40',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2',
    fontSize: 'sm',
    fontWeight: 'semibold',
    color: 'white',
    bg: 'red.600',
    px: '4',
    py: '2',
    textAlign: 'center',
    paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
  },
})

// Mounted once at the app root (see App.tsx) so every surface — participant
// screens on flaky mobile connections and the admin console alike — gets the
// same signal when a fetch/RPC would silently fail. This is a plain browser
// online/offline indicator, not tied to any sync-on-reconnect queue (T26,
// deferred to V2), so there's nothing here to replay once back online.
export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    function handleOnline() {
      setOnline(true)
    }
    function handleOffline() {
      setOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online) return null

  return <Banner role="status">You're offline — reconnect to keep playing.</Banner>
}
