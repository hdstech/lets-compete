import { styled } from '../../../styled-system/jsx'

// The segments belonging to a round live inline on that round's card (rather
// than a separate page), so these primitives lay them out as a nested list.
export const SegmentList = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3.5',
    py: '2',
  },
})

// Each segment renders as its own card. It carries no shadow at rest — the
// drop shadow only appears on hover — and the `interactive` variant (applied
// to the display rows, not the inline edit/add forms) drives that hover. Every
// property that changes between states is listed in `transition` so all of the
// item's visual state changes animate.
export const SegmentRowItem = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3',
    bg: '#ececec',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'card',
    boxShadow: 'none',
    px: '4',
    py: '4',
    transition:
      'box-shadow 0.18s ease, transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease',
  },
  variants: {
    interactive: {
      true: {
        _hover: {
          transform: 'translateY(-2px)',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
        },
      },
    },
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
    fontWeight: 'bold',
    color: 'text.primary',
  },
})
