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

// Each segment renders as its own card: a clean surface with an obvious drop
// shadow so the items read as distinct, and a lift-on-hover for feedback. The
// `interactive` variant is applied only to the display rows — the inline edit
// and add forms reuse the card shell without the hover motion.
export const SegmentRowItem = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3',
    bg: 'bg.surface',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'card',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
    px: '4',
    py: '4',
    transition:
      'box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease',
  },
  variants: {
    interactive: {
      true: {
        _hover: {
          transform: 'translateY(-2px)',
          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.18)',
          borderColor: 'ink.400',
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
    fontWeight: 'medium',
    color: 'text.primary',
  },
})
