import { Calendar } from 'lucide-react'
import { styled } from '../../styled-system/jsx'
import { LinkButton } from '../components/ui/Button'
import { Title as PageTitle, Subtitle as PageSubtitle } from '../components/ui/Typography'
import {
  Card,
  DefinitionGrid,
  DefinitionTerm,
  DefinitionValue,
  SectionTitle,
} from '../features/events/events-ui'
import { useAuth } from '../features/auth/useAuth'

const OverviewPage = styled('div', {
  base: {
    px: '6',
    py: '6',
  },
})

const PageHeader = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1',
    mb: '6',
  },
})

const OverviewGrid = styled('div', {
  base: {
    display: 'grid',
    gridTemplateColumns: { base: '1fr', lg: '2fr 1fr' },
    gap: '5',
  },
})

const WelcomeText = styled('p', {
  base: {
    fontSize: 'sm',
    color: 'text.muted',
  },
})

const IconBadge = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '10',
    height: '10',
    borderRadius: 'control',
    bg: 'bg.sunken',
    color: 'text.primary',
  },
})

export function DashboardPage() {
  const { user } = useAuth()
  const name = user?.user_metadata.name as string | undefined

  return (
    <OverviewPage>
      <PageHeader>
        <PageTitle>Overview</PageTitle>
        <PageSubtitle>{name ? `Welcome back, ${name}` : 'Welcome back'}</PageSubtitle>
      </PageHeader>

      <OverviewGrid>
        <Card>
          <IconBadge>
            <Calendar size={18} />
          </IconBadge>
          <SectionTitle>Your events</SectionTitle>
          <WelcomeText>
            Create, configure, and run scored events from one place — rounds, segments, and
            questions all live under each event.
          </WelcomeText>
          <div>
            <LinkButton to="/events" tone="primary">
              Manage your events
            </LinkButton>
          </div>
        </Card>

        <Card>
          <SectionTitle>Account</SectionTitle>
          <DefinitionGrid>
            <DefinitionTerm>Name</DefinitionTerm>
            <DefinitionValue>{name ?? '—'}</DefinitionValue>
            <DefinitionTerm>Email</DefinitionTerm>
            <DefinitionValue>{user?.email ?? '—'}</DefinitionValue>
          </DefinitionGrid>
        </Card>
      </OverviewGrid>
    </OverviewPage>
  )
}
