import { useEffect, useRef } from 'react'
import { styled } from '../../../styled-system/jsx'
import { Row } from '../../features/events/events-ui'
import { Button } from './Button'

const DialogOverlay = styled('div', {
  base: {
    position: 'fixed',
    inset: 0,
    bg: 'rgba(0, 0, 0, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    p: '4',
    zIndex: '50',
  },
})

const DialogCard = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4',
    bg: 'bg.surface',
    borderRadius: 'card',
    p: '5',
    width: 'full',
    maxWidth: 'sm',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
  },
})

const DialogTitle = styled('h2', {
  base: { fontSize: 'md', fontWeight: 'semibold', color: 'text.primary' },
})

const DialogBody = styled('p', {
  base: { fontSize: 'sm', color: 'text.muted' },
})

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    // Focus the safe (cancel) action, not the destructive one, so a stray
    // Enter keypress can't confirm a delete.
    cancelButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <DialogOverlay onClick={onCancel}>
      <DialogCard
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
        <DialogBody id="confirm-dialog-description">{description}</DialogBody>
        <Row style={{ justifyContent: 'flex-end' }}>
          <Button
            ref={cancelButtonRef}
            type="button"
            tone="secondary"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button type="button" tone={tone} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </Row>
      </DialogCard>
    </DialogOverlay>
  )
}
