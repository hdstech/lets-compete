import { styled } from '../../../styled-system/jsx'

// The surface every panel in the app sits on. `interactive` is for cards that
// are themselves a link or button: they lift toward the reader and pick up the
// accent edge, the same gesture the landing page's feature cards use.
export const Card = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4',
    bg: 'bg.surface',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'card',
    boxShadow: 'card',
    p: { base: '4', sm: '5' },
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
  },
  variants: {
    interactive: {
      true: {
        cursor: 'pointer',
        textDecoration: 'none',
        color: 'inherit',
        _hover: {
          borderColor: 'accent.default',
          boxShadow: 'lifted',
          transform: 'translateY(-2px)',
        },
        _motionReduce: { _hover: { transform: 'none' } },
        _focusVisible: {
          outline: '2px solid',
          outlineColor: 'accent.default',
          outlineOffset: '2px',
        },
      },
    },
    // Drops the surface fill for a card that groups already-carded children
    // (a round's segments, a results scope's boards).
    quiet: {
      true: { bg: 'bg.canvas.100', boxShadow: 'none' },
    },
  },
})

// Icon tile + title + optional description, in the layout the landing page
// established: a brand-blue rounded square anchoring the heading.
export const CardHeader = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '3',
  },
})

export const CardHeaderText = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1',
    minWidth: '0',
    flex: '1',
  },
})

export const CardTitle = styled('h2', {
  base: {
    fontSize: 'md',
    fontWeight: 'bold',
    color: 'text.primary',
    overflowWrap: 'anywhere',
  },
})

export const CardDescription = styled('p', {
  base: {
    fontSize: 'sm',
    color: 'text.muted',
  },
})

export const IconTile = styled('span', {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: '0',
    width: '9',
    height: '9',
    borderRadius: 'control',
    bg: 'accent.solid',
    color: 'accent.onSolid',
  },
  variants: {
    tone: {
      accent: { bg: 'accent.solid', color: 'accent.onSolid' },
      // For a tile that must not pull focus — an empty state, or a header
      // sitting next to a louder control.
      subtle: { bg: 'accent.subtle', color: 'accent.fg' },
      neutral: { bg: 'bg.sunken', color: 'text.muted' },
      danger: { bg: 'danger.subtle', color: 'danger.fg' },
    },
    size: {
      sm: { width: '7', height: '7' },
      md: { width: '9', height: '9' },
      lg: { width: '12', height: '12' },
    },
  },
  defaultVariants: { tone: 'accent', size: 'md' },
})
