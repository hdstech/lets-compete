import { styled } from '../../../styled-system/jsx'

// The segments belonging to a round now live inline on that round's card
// (rather than a separate page), so these primitives lay them out as a
// nested, visually-inset list within the card.
export const SegmentList = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3',
  },
})

export const SegmentRowItem = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3',
    bg: 'bg.canvas',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'control',
    p: '3',
  },
})

export const SegmentTitle = styled('h3', {
  base: { fontSize: 'sm', fontWeight: 'medium', color: 'text.primary' },
})
