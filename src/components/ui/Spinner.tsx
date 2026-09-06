import type { ComponentProps } from 'react'
import { styled } from '../../../styled-system/jsx'

const SpinnerBase = styled('span', {
  base: {
    display: 'inline-block',
    borderStyle: 'solid',
    borderColor: 'border.default',
    borderTopColor: 'accent.default',
    borderRadius: 'full',
    animation: 'spin 0.8s linear infinite',
  },
  variants: {
    size: {
      sm: { width: '4', height: '4', borderWidth: '2px' },
      md: { width: '5', height: '5', borderWidth: '2px' },
      lg: { width: '8', height: '8', borderWidth: '3px' },
    },
  },
  defaultVariants: { size: 'md' },
})

export function Spinner(props: ComponentProps<typeof SpinnerBase>) {
  return <SpinnerBase role="status" aria-label="Loading" {...props} />
}
