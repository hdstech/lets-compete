import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'

// 'live' is the only state in which what's on screen can be trusted to be
// current. 'interrupted' is the one that matters: a dead socket looks
// exactly like a quiet event, so the screen has to say which it is. 'idle'
// means there is deliberately nothing to subscribe to yet (no round open,
// participant not admitted) — distinct from 'connecting', which is a
// subscription actually in flight.
export type RealtimeStatus = 'idle' | 'connecting' | 'live' | 'interrupted'

// Several screens watch more than one channel and show a single indicator.
// The aggregate is the weakest of them, because one dead channel is enough
// to make the page stale — but channels that aren't open yet are skipped
// rather than pinning the badge to "Connecting…" forever.
export function combineRealtimeStatus(...statuses: RealtimeStatus[]): RealtimeStatus {
  if (statuses.includes('interrupted')) return 'interrupted'

  const active = statuses.filter((status) => status !== 'idle')
  if (active.length === 0) return 'idle'

  return active.every((status) => status === 'live') ? 'live' : 'connecting'
}

// Bounded on purpose. An organizer leaves the live console open for a whole
// event, and hammering a project that is genuinely down is worse than a
// badge that says the connection is gone — at the cap we keep retrying at
// the longest interval rather than giving up entirely, since the far more
// common cause is a laptop lid or a tunnel, not a dead backend.
const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 30000]

type Options = {
  // Stable identity for the channel. Changing it tears down and resubscribes.
  channelName: string | null
  // Wires the channel's listeners. Must be memoized with useCallback: its
  // identity is a dependency, so the channel is torn down and rebuilt
  // whenever it changes. That is deliberate — the handler closes over state
  // (which questions are on screen, which refresh function to call), and
  // pinning the first closure would leave the channel calling a stale one.
  subscribe: (channel: RealtimeChannel) => RealtimeChannel
  // Run after a dropped channel comes back. Postgres Changes delivers
  // nothing that happened while the socket was down, so resuming from the
  // state we had is resuming from stale state.
  onReconnect?: () => void
}

// Wraps the `channel(...).on(...).subscribe()` pattern the live screens
// share. Every call site previously passed no status callback at all, so a
// CHANNEL_ERROR or TIMED_OUT silently killed live updates with nothing on
// screen to say so.
export function useRealtimeChannel({
  channelName,
  subscribe,
  onReconnect,
}: Options): RealtimeStatus {
  // Tracks only an *open* channel's health. Whether there's a channel at
  // all is derived below rather than stored, which keeps the effect free of
  // the setState-on-mount that reporting 'idle' from inside it would need.
  const [connection, setConnection] = useState<Exclude<RealtimeStatus, 'idle'>>('connecting')

  // Reset during render when the channel identity changes (React's
  // documented pattern for adjusting state from a changed value), so a new
  // channel doesn't inherit the previous one's health for a frame. A
  // resubscribe that keeps the same name — a `subscribe` closure rebuilt
  // around fresher state — deliberately isn't reset, to avoid flickering a
  // healthy badge through 'connecting'.
  const [connectionForChannel, setConnectionForChannel] = useState(channelName)
  if (channelName !== connectionForChannel) {
    setConnectionForChannel(channelName)
    setConnection('connecting')
  }

  // `onReconnect` is only ever *called*, never used to build the channel, so
  // it goes through a ref — that spares callers from memoizing it just to
  // avoid needless resubscribes, while the retry loop still calls the
  // current one.
  const onReconnectRef = useRef(onReconnect)
  useEffect(() => {
    onReconnectRef.current = onReconnect
  })

  useEffect(() => {
    if (!channelName) return

    let cancelled = false
    let channel: RealtimeChannel | null = null
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0
    // Distinguishes the first connect from a recovery, so onReconnect only
    // fires when there is actually a gap to catch up on.
    let hasConnected = false

    function connect() {
      if (cancelled) return

      channel = subscribe(supabase.channel(channelName as string))
      channel.subscribe((channelStatus) => {
        if (cancelled) return

        if (channelStatus === 'SUBSCRIBED') {
          attempt = 0
          setConnection('live')
          if (hasConnected) onReconnectRef.current?.()
          hasConnected = true
          return
        }

        if (
          channelStatus === 'CHANNEL_ERROR' ||
          channelStatus === 'TIMED_OUT' ||
          channelStatus === 'CLOSED'
        ) {
          setConnection('interrupted')
          scheduleRetry()
        }
      })
    }

    function scheduleRetry() {
      if (cancelled || retryTimer !== undefined) return

      const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]
      attempt += 1

      retryTimer = setTimeout(() => {
        retryTimer = undefined
        if (cancelled) return
        if (channel) {
          supabase.removeChannel(channel)
          channel = null
        }
        connect()
      }, delay)
    }

    connect()

    return () => {
      cancelled = true
      if (retryTimer !== undefined) clearTimeout(retryTimer)
      if (channel) supabase.removeChannel(channel)
    }
  }, [channelName, subscribe])

  return channelName ? connection : 'idle'
}
