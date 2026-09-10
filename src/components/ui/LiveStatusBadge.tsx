import { styled } from '../../../styled-system/jsx'
import type { RealtimeStatus } from '../../lib/use-realtime-channel'

const StatusPill = styled('span', {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1.5',
    flexShrink: '0',
    borderRadius: 'pill',
    borderWidth: '1px',
    px: '2.5',
    py: '1',
    fontSize: 'xs',
    fontWeight: 'semibold',
    lineHeight: 'tight',
    whiteSpace: 'nowrap',
  },
  variants: {
    tone: {
      live: { bg: 'success.subtle', color: 'success.fg', borderColor: 'success.border' },
      interrupted: { bg: 'danger.subtle', color: 'danger.fg', borderColor: 'danger.border' },
      connecting: { bg: 'bg.sunken', color: 'text.muted', borderColor: 'border.default' },
    },
    // The participant header sits on the brand gradient, where the tinted
    // pills above lose their contrast — this matches PlayerHeaderBadge.
    onBrand: {
      true: {
        bg: 'rgba(255, 255, 255, 0.2)',
        borderColor: 'rgba(255, 255, 255, 0.38)',
        color: 'white',
      },
    },
  },
  defaultVariants: { tone: 'connecting' },
})

const Dot = styled('span', {
  base: {
    width: '1.5',
    height: '1.5',
    borderRadius: 'pill',
    bg: 'currentcolor',
    flexShrink: '0',
  },
  variants: {
    pulse: {
      true: {
        animation: 'pulseDot 1.8s ease-in-out infinite',
        _motionReduce: { animation: 'none' },
      },
    },
  },
})

const LABELS: Record<Exclude<RealtimeStatus, 'idle'>, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  interrupted: 'Live updates interrupted',
}

// Says out loud whether what's on screen is actually keeping up. Without it
// a dead realtime socket is indistinguishable from an event where nothing
// has happened yet, which is the worse of the two to be wrong about: the
// organizer waits for a reveal that already happened, or the participant
// waits for a question that's already counting down.
export function LiveStatusBadge({
  status,
  onBrand,
}: {
  status: RealtimeStatus
  /** Set on the participant header, which renders over the brand gradient. */
  onBrand?: boolean
}) {
  // Nothing to watch yet (no round open, participant not admitted): there's
  // no connection to report on, so the badge stays out of the header rather
  // than sitting on "Connecting…" indefinitely.
  if (status === 'idle') return null

  const interrupted = status === 'interrupted'

  return (
    <StatusPill
      tone={status}
      onBrand={onBrand}
      role="status"
      aria-live="polite"
      title={
        interrupted
          ? "Live updates dropped out — retrying. What's on screen may be out of date."
          : undefined
      }
    >
      <Dot pulse={status !== 'live'} />
      {LABELS[status]}
    </StatusPill>
  )
}
