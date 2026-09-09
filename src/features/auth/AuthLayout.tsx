import type { ReactNode } from 'react'
import { Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { styled } from '../../../styled-system/jsx'
import { ThemeToggle } from '../../components/ui/ThemeToggle'
import {
  BrandGlow,
  BrandGrid,
  BrandHeadline,
  BrandSurface,
  BrandText,
  BrandWordmark,
  BrandWordmarkBadge,
} from '../../components/ui/brand-surface'
import { AuthCard, AuthMain, AuthRoot } from './auth-ui'

// The wordmark doubles as the way back to the landing page.
const HomeLink = styled(Link, {
  base: {
    color: 'inherit',
    textDecoration: 'none',
    alignSelf: 'flex-start',
    borderRadius: 'control',
    _focusVisible: {
      outline: '2px solid white',
      outlineOffset: '4px',
    },
  },
})

// On a phone the panel shrinks to its wordmark and headline; the supporting
// copy would push the form itself below the fold for no gain.
const AsideCopy = styled('div', {
  base: {
    display: { base: 'none', lg: 'flex' },
    flexDirection: 'column',
    gap: '4',
  },
})

export function AuthLayout({
  headline,
  blurb,
  children,
}: {
  headline: string
  blurb: string
  children: ReactNode
}) {
  return (
    <AuthRoot>
      <BrandSurface layout="aside">
        <BrandGlow placement="top" />
        <BrandGrid />

        <HomeLink to="/">
          <BrandWordmark>
            <BrandWordmarkBadge>
              <Trophy size={18} aria-hidden="true" />
            </BrandWordmarkBadge>
            Let's Compete
          </BrandWordmark>
        </HomeLink>

        <AsideCopy>
          <BrandHeadline size="panel">{headline}</BrandHeadline>
          <BrandText size="sm">{blurb}</BrandText>
        </AsideCopy>
      </BrandSurface>

      <AuthMain>
        <ThemeToggle floating />
        <AuthCard>{children}</AuthCard>
      </AuthMain>
    </AuthRoot>
  )
}
