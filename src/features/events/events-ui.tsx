import { Link } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'

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
  },
})

export const PageHeader = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '4',
    flexWrap: 'wrap',
  },
})

export const BackLink = styled(Link, {
  base: { fontSize: 'sm', color: 'text.muted', textDecoration: 'underline' },
})

export const Card = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4',
    bg: 'bg.surface',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'card',
    p: '5',
  },
})

export const SectionTitle = styled('h2', {
  base: { fontSize: 'sm', fontWeight: 'semibold', color: 'text.muted' },
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
    flexDirection: 'column',
    gap: '1.5',
    bg: 'bg.surface',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'card',
    p: '4',
    textDecoration: 'none',
    color: 'inherit',
    _hover: { borderColor: 'accent.default' },
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
  base: { fontSize: 'md', fontWeight: 'semibold' },
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
    borderColor: 'border.default',
    borderRadius: 'card',
    p: '6',
    textAlign: 'center',
    color: 'text.muted',
    fontSize: 'sm',
  },
})

export const EmptyStateIcon = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '10',
    height: '10',
    borderRadius: 'control',
    bg: 'bg.sunken',
    color: 'text.muted',
  },
})

export const StatusBadge = styled('span', {
  base: {
    fontSize: 'xs',
    fontWeight: 'semibold',
    borderRadius: 'full',
    px: '2.5',
    py: '1',
    textTransform: 'capitalize',
  },
  variants: {
    status: {
      draft: { bg: 'bg.sunken', color: 'text.primary' },
      active: { bg: 'green.700', color: 'green.50' },
      concluded: { bg: 'indigo.700', color: 'indigo.50' },
    },
  },
})

export const FormatBadge = styled('span', {
  base: {
    fontSize: 'xs',
    fontWeight: 'semibold',
    borderRadius: 'full',
    px: '2.5',
    py: '1',
    textTransform: 'capitalize',
    bg: 'bg.sunken',
    color: 'text.muted',
  },
})

export const Row = styled('div', {
  base: { display: 'flex', alignItems: 'center', gap: '3', flexWrap: 'wrap' },
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
  },
})

export const CopyableCode = styled('code', {
  base: {
    fontFamily: 'mono',
    fontSize: 'sm',
    bg: 'bg.canvas',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'md',
    px: '2.5',
    py: '1.5',
    letterSpacing: 'wide',
  },
})

export const DefinitionGrid = styled('dl', {
  base: {
    display: 'grid',
    gridTemplateColumns: { base: '1fr', sm: '1fr 1fr' },
    gap: '3',
    fontSize: 'sm',
    minWidth: '0',
  },
})

export const DefinitionTerm = styled('dt', {
  base: {
    color: 'text.placeholder',
    fontSize: 'xs',
    textTransform: 'uppercase',
    letterSpacing: 'wide',
  },
})

export const DefinitionValue = styled('dd', {
  base: {
    color: 'text.primary',
    minWidth: '0',
    overflowWrap: 'anywhere',
  },
})
