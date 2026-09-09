import { styled } from '../../../styled-system/jsx'
import { badge } from '../../../styled-system/recipes'

export const Badge = styled('span', badge)

// A 6px dot for the badges that report a *live* condition (an event that is
// running, a round that is open) rather than a static attribute. `pulse` is
// reserved for states that are actively changing under the reader.
export const StatusDot = styled('span', {
  base: {
    width: '1.5',
    height: '1.5',
    borderRadius: 'pill',
    bg: 'currentColor',
    flexShrink: '0',
  },
  variants: {
    pulse: {
      true: {
        animation: 'pulseDot 1.6s ease-in-out infinite',
        _motionReduce: { animation: 'none' },
      },
    },
  },
})
