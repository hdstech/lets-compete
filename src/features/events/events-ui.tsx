/* eslint-disable react-refresh/only-export-components --
 * This file re-exports shared components (Button, LinkButton, PageTitle,
 * PageSubtitle from src/components/ui) alongside its own styled primitives.
 * The rule's whole-module check can't tell a same-identity re-export from a
 * genuinely non-component export, and once it sees one it flags every export
 * in the file — so the disable has to cover the whole module, not just the
 * re-export lines themselves.
 */
import { Link } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'
import { Button as SharedButton, LinkButton as SharedLinkButton } from '../../components/ui/Button'
import { Title, Subtitle } from '../../components/ui/Typography'

export const Button = SharedButton
export const LinkButton = SharedLinkButton
export const PageTitle = Title
export const PageSubtitle = Subtitle

export const PageShell = styled('main', {
  base: {
    minHeight: '100vh',
    bg: 'bg.canvas',
    color: 'text.primary',
    px: '4',
    py: '10',
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
    fontSize: 'sm',
    color: 'text.primary',
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
    gridTemplateColumns: '1fr 1fr',
    gap: '3',
    fontSize: 'sm',
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
  base: { color: 'text.primary' },
})
