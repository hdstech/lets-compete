import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { styled } from '../../../styled-system/jsx'
import { classifyError } from '../../lib/errors'
import { Button } from './Button'
import { Subtitle, Title } from './Typography'

const FallbackScreen = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100dvh',
    width: 'full',
    bg: 'bg.canvas',
    color: 'text.primary',
    px: '4',
    py: '8',
  },
  variants: {
    // The admin-shell boundary renders inside the shell's content column, so
    // it fills that column rather than the viewport — the sidebar stays put
    // and the rest of the console stays navigable.
    inline: {
      true: { minHeight: 'auto', paddingBlock: '16', bg: 'transparent' },
    },
  },
})

const FallbackCard = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '3',
    width: 'full',
    maxWidth: '32rem',
    borderWidth: '1px',
    borderColor: 'border.default',
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
    bg: 'danger.subtle',
    color: 'danger.fg',
    borderWidth: '1px',
    borderColor: 'danger.border',
  },
})

// The message is the thrown error's own text, so a crash says something more
// useful than "something went wrong" — but it's rendered as detail beneath a
// plain-language line, not as the headline, since a stack-shaped string is
// not an explanation on its own.
const Detail = styled('p', {
  base: {
    fontSize: 'xs',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    color: 'text.muted',
    overflowWrap: 'anywhere',
    borderTopWidth: '1px',
    borderColor: 'border.default',
    paddingTop: '3',
    width: 'full',
    margin: '0',
  },
})

const ActionRow = styled('div', {
  base: { display: 'flex', flexWrap: 'wrap', gap: '2' },
})

type Props = {
  children: ReactNode
  // Set on the admin-shell boundary so the fallback sits in the content
  // column instead of taking over the viewport.
  inline?: boolean
  // Reset key: when it changes the boundary un-latches, so navigating away
  // from a page that crashed doesn't leave the fallback stuck on screen.
  resetKey?: string
}

type State = { error: Error | null }

// React has no hook equivalent for componentDidCatch, so this stays a class.
// Without it a render-time throw unmounts the whole tree and leaves a blank
// white page — the single least informative failure the app can produce.
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // There's no error-reporting service wired up yet, so the console is the
    // only place the component stack survives for debugging.
    console.error('Unhandled render error:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const { message } = classifyError(error, 'The screen failed to render.')

    return (
      <FallbackScreen inline={this.props.inline}>
        <FallbackCard>
          <IconBadge>
            <TriangleAlert size={20} aria-hidden="true" />
          </IconBadge>
          <Title size="card">Something went wrong</Title>
          <Subtitle role="alert">
            This screen hit an unexpected error and stopped. Reloading usually clears
            it — if it keeps happening, the detail below is what to report.
          </Subtitle>
          <ActionRow>
            <Button type="button" tone="primary" onClick={() => window.location.reload()}>
              Reload the page
            </Button>
            {!this.props.inline && (
              <Button
                type="button"
                tone="secondary"
                onClick={() => {
                  window.location.href = '/'
                }}
              >
                Go home
              </Button>
            )}
          </ActionRow>
          <Detail>{message}</Detail>
        </FallbackCard>
      </FallbackScreen>
    )
  }
}
