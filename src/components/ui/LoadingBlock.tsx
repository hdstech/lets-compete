import { styled } from '../../../styled-system/jsx'
import { Spinner } from './Spinner'

const LoadingRow = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '2',
    fontSize: 'sm',
    color: 'text.muted',
  },
})

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <LoadingRow>
      <Spinner size="sm" />
      <span>{label}</span>
    </LoadingRow>
  )
}
