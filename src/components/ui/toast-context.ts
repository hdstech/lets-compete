import { createContext } from 'react'

// Errors get an assertive live region and stay until dismissed; status
// messages get a polite one and clear themselves. See ToastProvider for why
// errors don't auto-dismiss.
export type ToastTone = 'error' | 'status'

export type Toast = {
  id: number
  // Caller-supplied identity for a *recurring* condition (a flapping
  // realtime channel, a refresh that keeps failing). Re-showing the same key
  // refreshes the existing toast instead of stacking another copy.
  key: string
  tone: ToastTone
  message: string
}

export type ShowToastOptions = {
  // Defaults to the message itself, which is the right behaviour for
  // one-off failures — two identical messages are never worth two toasts.
  key?: string
}

export type ToastContextValue = {
  showError: (message: string, options?: ShowToastOptions) => void
  showStatus: (message: string, options?: ShowToastOptions) => void
  dismiss: (id: number) => void
  // Clears a keyed toast once the condition behind it resolves — a
  // reconnected channel retracting its own "interrupted" message, say.
  dismissKey: (key: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
