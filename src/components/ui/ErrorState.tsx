import { styled } from '../../../styled-system/jsx'
import { Button } from './Button'

const ErrorCard = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '3',
    borderWidth: '1px',
    borderColor: 'danger.border',
    borderRadius: 'card',
    bg: 'danger.subtle',
    p: '5',
  },
})

const ErrorMessage = styled('p', {
  base: { fontSize: 'sm', color: 'danger.fg', fontWeight: 'medium' },
})

export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <ErrorCard>
      <ErrorMessage role="alert">{message}</ErrorMessage>
      {onRetry && (
        <Button type="button" tone="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </ErrorCard>
  )
}
