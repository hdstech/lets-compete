import { styled } from '../../../styled-system/jsx'

// The segments belonging to a round live inline on that round's card (rather
// than a separate page), so these primitives lay them out as a nested list.
export const SegmentList = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3',
  },
})

// Each segment renders as its own soft-shadowed card (not a flat grey block),
// so it reads as a distinct item sitting on the round card.
export const SegmentRowItem = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3',
    bg: 'bg.surface',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'card',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)',
    p: '3',
  },
})

// The segment's name and its actions sit together on one row, wrapping only
// when there isn't room.
export const SegmentRowMain = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '3',
    flexWrap: 'wrap',
  },
})

export const SegmentActions = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '2',
    flexWrap: 'wrap',
  },
})

export const SegmentTitle = styled('h3', {
  base: {
    minWidth: '0',
    fontSize: 'sm',
    fontWeight: 'medium',
    color: 'text.primary',
  },
})
