import { Link } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'

// Page chrome shared by every organizer screen. The card surface itself now
// lives in components/ui/Card so the participant screens can use it too.

export const PageShell = styled('main', {
  base: {
    minHeight: '100dvh',
    bg: 'bg.canvas',
    color: 'text.primary',
    px: { base: '3', sm: '4' },
    py: { base: '6', sm: '10' },
    overflowX: 'hidden',
    paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
    paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
  },
})

export const PageInner = styled('div', {
  base: {
    maxWidth: '2xl',
    mx: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '6',
    animation: 'riseIn 0.35s ease-out both',
    _motionReduce: { animation: 'none' },
  },
})

export const PageHeader = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '4',
    flexWrap: 'wrap',
  },
})

export const BackLink = styled(Link, {
  base: {
    fontSize: 'sm',
    fontWeight: 'medium',
    color: 'text.muted',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1.5',
    transition: 'color 0.18s ease',
    _hover: { color: 'accent.default' },
  },
})

// The heading of a card section ("Details", "Participants", "Add round").
// It reads as a real heading now rather than a muted caption.
export const SectionTitle = styled('h2', {
  base: {
    fontSize: 'md',
    fontWeight: 'bold',
    color: 'text.primary',
    overflowWrap: 'anywhere',
  },
})

export const HelpText = styled('p', {
  base: { fontSize: 'xs', color: 'text.placeholder' },
})

export const EventList = styled('div', {
  base: { display: 'flex', flexDirection: 'column', gap: '3' },
})

export const EventListItem = styled(Link, {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '3.5',
    bg: 'bg.surface',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'card',
    boxShadow: 'card',
    p: '4',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
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
})

export const EventListItemBody = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5',
    minWidth: '0',
    flex: '1',
  },
})

export const EventListItemTitleRow = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '3',
    flexWrap: 'wrap',
  },
})

export const EventName = styled('span', {
  base: { fontSize: 'md', fontWeight: 'bold' },
})

export const EventMeta = styled('span', {
  base: { fontSize: 'xs', color: 'text.muted' },
})

export const EmptyState = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'border.strong',
    borderRadius: 'card',
    bg: 'bg.surface',
    p: { base: '6', sm: '8' },
    textAlign: 'center',
    color: 'text.muted',
    fontSize: 'sm',
  },
})

export const Row = styled('div', {
  base: { display: 'flex', alignItems: 'center', gap: '3', flexWrap: 'wrap' },
  variants: {
    // For a row of buttons that form one action set (e.g. Cancel/Confirm,
    // Edit/Delete) — makes them equal width instead of sizing to their own
    // label. Only apply where every child is a button-like action; a badge
    // or help text sibling would stretch to match too.
    equal: {
      true: { '& > *': { flex: '1', minWidth: '0' } },
    },
  },
})

export const CheckboxField = styled('label', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '2',
    minHeight: '11',
    fontSize: 'sm',
    color: 'text.primary',
    cursor: 'pointer',
    accentColor: 'accent.solid',
  },
})

export const CopyableCode = styled('code', {
  base: {
    fontFamily: 'mono',
    fontSize: 'sm',
    fontWeight: 'semibold',
    bg: 'accent.subtle',
    color: 'accent.fg',
    borderWidth: '1px',
    borderColor: 'accent.border',
    borderRadius: 'control',
    px: '2.5',
    py: '1.5',
    letterSpacing: 'wide',
  },
})

export const DefinitionGrid = styled('dl', {
  base: {
    display: 'grid',
    gap: '3',
    fontSize: 'sm',
    minWidth: '0',
  },
  variants: {
    columns: {
      two: { gridTemplateColumns: { base: '1fr', sm: '1fr 1fr' } },
      // Term above value, for a narrow column.
      stacked: { gridTemplateColumns: '1fr', gap: '1' },
    },
  },
  defaultVariants: { columns: 'two' },
})

export const DefinitionTerm = styled('dt', {
  base: {
    color: 'text.placeholder',
    fontSize: 'xs',
    fontWeight: 'semibold',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
})

export const DefinitionValue = styled('dd', {
  base: {
    color: 'text.primary',
    fontWeight: 'medium',
    minWidth: '0',
    overflowWrap: 'anywhere',
  },
})
