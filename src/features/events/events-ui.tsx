import { Link } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'

export const PageShell = styled('main', {
  base: {
    minHeight: '100vh',
    bg: 'slate.950',
    color: 'slate.100',
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

export const PageTitle = styled('h1', {
  base: { fontSize: 'xl', fontWeight: 'semibold' },
})

export const PageSubtitle = styled('p', {
  base: { fontSize: 'sm', color: 'slate.400' },
})

export const BackLink = styled(Link, {
  base: { fontSize: 'sm', color: 'slate.400', textDecoration: 'underline' },
})

export const Card = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4',
    bg: 'slate.900',
    borderWidth: '1px',
    borderColor: 'slate.800',
    borderRadius: 'lg',
    p: '5',
  },
})

export const SectionTitle = styled('h2', {
  base: { fontSize: 'sm', fontWeight: 'semibold', color: 'slate.300' },
})

export const HelpText = styled('p', {
  base: { fontSize: 'xs', color: 'slate.500' },
})

export const EventList = styled('div', {
  base: { display: 'flex', flexDirection: 'column', gap: '3' },
})

export const EventListItem = styled(Link, {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5',
    bg: 'slate.900',
    borderWidth: '1px',
    borderColor: 'slate.800',
    borderRadius: 'lg',
    p: '4',
    textDecoration: 'none',
    color: 'inherit',
    _hover: { borderColor: 'slate.600' },
  },
})

export const EventListItemTitleRow = styled('div', {
  base: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '3' },
})

export const EventName = styled('span', {
  base: { fontSize: 'md', fontWeight: 'semibold' },
})

export const EventMeta = styled('span', {
  base: { fontSize: 'xs', color: 'slate.400' },
})

export const EmptyState = styled('div', {
  base: {
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'slate.800',
    borderRadius: 'lg',
    p: '6',
    textAlign: 'center',
    color: 'slate.400',
    fontSize: 'sm',
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
      draft: { bg: 'slate.700', color: 'slate.100' },
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
    bg: 'slate.800',
    color: 'slate.300',
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
    color: 'slate.300',
  },
})

const buttonRecipe = {
  base: {
    borderRadius: 'md',
    px: '4',
    py: '2',
    fontSize: 'sm',
    fontWeight: 'semibold',
    cursor: 'pointer',
    borderWidth: '1px',
    borderColor: 'transparent',
    display: 'inline-block',
    textDecoration: 'none',
    textAlign: 'center',
    _disabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
  variants: {
    tone: {
      primary: { bg: 'slate.100', color: 'slate.950' },
      secondary: { bg: 'transparent', color: 'slate.100', borderColor: 'slate.700' },
      danger: { bg: 'red.600', color: 'white' },
      success: { bg: 'green.600', color: 'white' },
    },
  },
  defaultVariants: { tone: 'primary' },
} as const

export const Button = styled('button', buttonRecipe)
export const LinkButton = styled(Link, buttonRecipe)

export const CopyableCode = styled('code', {
  base: {
    fontFamily: 'mono',
    fontSize: 'sm',
    bg: 'slate.950',
    borderWidth: '1px',
    borderColor: 'slate.700',
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
  base: { color: 'slate.500', fontSize: 'xs', textTransform: 'uppercase', letterSpacing: 'wide' },
})

export const DefinitionValue = styled('dd', {
  base: { color: 'slate.100' },
})
