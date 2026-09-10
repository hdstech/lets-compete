import { TriangleAlert } from 'lucide-react'
import { styled } from '../../../styled-system/jsx'
import { Subtitle, Title } from './Typography'

const Screen = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100dvh',
    width: 'full',
    bg: 'bg.canvas',
    color: 'text.primary',
    px: '4',
    py: '8',
  },
})

const Panel = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '3',
    width: 'full',
    maxWidth: '34rem',
    borderWidth: '1px',
    borderColor: 'warning.border',
    borderRadius: 'card',
    bg: 'bg.surface',
    boxShadow: 'card',
    p: { base: '5', sm: '6' },
  },
})

const IconBadge = styled('span', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '10',
    height: '10',
    borderRadius: 'control',
    bg: 'warning.subtle',
    color: 'warning.fg',
    borderWidth: '1px',
    borderColor: 'warning.border',
  },
})

const Reason = styled('p', {
  base: {
    width: 'full',
    margin: '0',
    borderRadius: 'control',
    bg: 'bg.sunken',
    px: '3',
    py: '2.5',
    fontSize: 'sm',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    color: 'text.primary',
    overflowWrap: 'anywhere',
  },
})

// Rendered by main.tsx in place of the app when the Supabase environment
// isn't configured. Nothing here touches the router or the Supabase client,
// because in this state neither one can be trusted to exist.
export function ConfigErrorScreen({ message }: { message: string }) {
  return (
    <Screen>
      <Panel>
        <IconBadge>
          <TriangleAlert size={20} aria-hidden="true" />
        </IconBadge>
        <Title size="card">The app isn't configured yet</Title>
        <Subtitle role="alert">
          It can't reach its backend, so nothing will load. This is a setup problem
          rather than an outage — fill in the environment values below and restart the
          dev server.
        </Subtitle>
        <Reason>{message}</Reason>
      </Panel>
    </Screen>
  )
}
