import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Info, TriangleAlert, X } from 'lucide-react'
import { styled } from '../../../styled-system/jsx'
import { OfflineBanner } from './OfflineBanner'
import { ToastContext } from './toast-context'
import type { ShowToastOptions, Toast, ToastTone } from './toast-context'

const STATUS_DISMISS_MS = 6000
// Beyond this the stack starts covering the screen it's reporting on, which
// is worse than losing the oldest message — a cascade of failures usually
// shares one cause anyway.
const MAX_VISIBLE = 3

// One fixed region at the top of the viewport owning everything the app says
// about *itself* rather than about the page: the offline strip and the
// toasts below it. Keeping them in a single stack is what guarantees a toast
// can never land on top of the offline banner. Anchored at the top rather
// than the bottom because the participant answering screen's composer — the
// submit button — owns the bottom of the phone screen.
const SystemStatusStack = styled('div', {
  base: {
    position: 'fixed',
    top: '0',
    insetInline: '0',
    zIndex: '50',
    display: 'flex',
    flexDirection: 'column',
    // The region spans the viewport so the banner can be full-bleed, but only
    // the cards themselves should catch clicks.
    pointerEvents: 'none',
  },
})

const ToastList = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: { base: 'stretch', sm: 'flex-end' },
    gap: '2',
    px: { base: '4', sm: '6' },
    // Clears the floating theme toggle the landing, auth and join pages pin
    // to the top-right (ThemeToggle's `floating` variant: 20px inset, 40px
    // tall). An error toast stays until it's dismissed, so covering that
    // control isn't something the user can just wait out.
    paddingTop: 'max(4.25rem, calc(env(safe-area-inset-top) + 0.75rem))',
  },
})

const ToastCard = styled('div', {
  base: {
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '2.5',
    width: 'full',
    maxWidth: '26rem',
    borderWidth: '1px',
    borderRadius: 'card',
    boxShadow: 'lifted',
    px: '4',
    py: '3',
    fontSize: 'sm',
    lineHeight: 'snug',
    animation: 'dropIn 0.22s ease-out both',
    _motionReduce: { animation: 'none' },
  },
  variants: {
    tone: {
      error: {
        bg: 'danger.subtle',
        borderColor: 'danger.border',
        color: 'danger.fg',
        fontWeight: 'medium',
      },
      status: {
        bg: 'bg.surface',
        borderColor: 'border.default',
        color: 'text.primary',
      },
    },
  },
  defaultVariants: { tone: 'status' },
})

const ToastIcon = styled('span', {
  base: {
    display: 'flex',
    flexShrink: '0',
    marginTop: '0.5',
  },
  variants: {
    tone: {
      error: { color: 'danger.fg' },
      status: { color: 'text.muted' },
    },
  },
  defaultVariants: { tone: 'status' },
})

const ToastMessage = styled('p', {
  base: { flex: '1', margin: '0' },
})

const DismissButton = styled('button', {
  base: {
    display: 'flex',
    flexShrink: '0',
    alignItems: 'center',
    justifyContent: 'center',
    // Comfortably tappable without visually bulking up the card.
    width: '6',
    height: '6',
    marginTop: '-0.5',
    marginRight: '-1',
    borderRadius: 'control',
    borderWidth: '0',
    bg: 'transparent',
    color: 'currentcolor',
    opacity: '0.7',
    cursor: 'pointer',
    _hover: { opacity: '1', bg: 'rgba(31, 31, 29, 0.08)' },
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'accent.default',
      outlineOffset: '1px',
    },
  },
})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  const nextId = useRef(1)

  const clearTimer = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const dismiss = useCallback(
    (id: number) => {
      clearTimer(id)
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    },
    [clearTimer],
  )

  const dismissKey = useCallback((key: string) => {
    setToasts((prev) => prev.filter((toast) => toast.key !== key))
  }, [])

  const show = useCallback(
    (tone: ToastTone, message: string, options?: ShowToastOptions) => {
      // A recurring condition (a channel that keeps dropping, a refresh that
      // keeps failing) replaces its own previous toast rather than stacking.
      const key = options?.key ?? message
      const id = nextId.current
      nextId.current += 1

      setToasts((prev) =>
        [...prev.filter((toast) => toast.key !== key), { id, key, tone, message }].slice(
          -MAX_VISIBLE,
        ),
      )

      // Errors stay until dismissed. An error the user blinked past is the
      // exact failure mode this whole surface exists to prevent.
      if (tone === 'status') {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), STATUS_DISMISS_MS),
        )
      }
    },
    [dismiss],
  )

  const showError = useCallback(
    (message: string, options?: ShowToastOptions) => show('error', message, options),
    [show],
  )
  const showStatus = useCallback(
    (message: string, options?: ShowToastOptions) => show('status', message, options),
    [show],
  )

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => clearTimeout(timer))
      pending.clear()
    }
  }, [])

  const value = useMemo(
    () => ({ showError, showStatus, dismiss, dismissKey }),
    [showError, showStatus, dismiss, dismissKey],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <SystemStatusStack>
        <OfflineBanner />
        <ToastList>
          {toasts.map((toast) => (
            <ToastCard
              key={toast.id}
              tone={toast.tone}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
            >
              <ToastIcon tone={toast.tone}>
                {toast.tone === 'error' ? (
                  <TriangleAlert size={16} aria-hidden="true" />
                ) : (
                  <Info size={16} aria-hidden="true" />
                )}
              </ToastIcon>
              <ToastMessage>{toast.message}</ToastMessage>
              <DismissButton
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(toast.id)}
              >
                <X size={14} aria-hidden="true" />
              </DismissButton>
            </ToastCard>
          ))}
        </ToastList>
      </SystemStatusStack>
    </ToastContext.Provider>
  )
}
