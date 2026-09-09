import { ArrowRight, Calendar, UserRound } from 'lucide-react'
import { styled } from '../../styled-system/jsx'
import { LinkButton } from '../components/ui/Button'
import { Title as PageTitle, Subtitle as PageSubtitle } from '../components/ui/Typography'
import {
  DefinitionGrid,
  DefinitionTerm,
  DefinitionValue,
} from '../features/events/events-ui'
import {
  Card,
  CardDescription,
  CardHeader,
  CardHeaderText,
  CardTitle,
  IconTile,
} from '../components/ui/Card'
import { useAuth } from '../features/auth/useAuth'

const OverviewPage = styled('div', {
  base: {
    px: { base: '4', sm: '6' },
    py: { base: '4', sm: '6' },
    animation: 'riseIn 0.35s ease-out both',
    _motionReduce: { animation: 'none' },
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
    alignItems: 'start',
  },
})

// The arrow on the primary action slides on hover, matching the landing
// page's call-to-action.
const ActionRow = styled('div', {
  base: {
    marginTop: '1',
    '& svg': { transition: 'transform 0.18s ease' },
    '&:hover svg': { transform: 'translateX(4px)' },
    _motionReduce: { '&:hover svg': { transform: 'none' } },
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
          <CardHeader>
            <IconTile>
              <Calendar size={18} />
            </IconTile>
            <CardHeaderText>
              <CardTitle>Your events</CardTitle>
              <CardDescription>
                Create, configure, and run scored events from one place — rounds,
                segments, and questions all live under each event.
              </CardDescription>
            </CardHeaderText>
          </CardHeader>
          <ActionRow>
            <LinkButton to="/events" tone="primary">
              Manage your events
              <ArrowRight size={16} aria-hidden="true" />
            </LinkButton>
          </ActionRow>
        </Card>

        <Card>
          <CardHeader>
            <IconTile tone="subtle">
              <UserRound size={18} />
            </IconTile>
            <CardHeaderText>
              <CardTitle>Account</CardTitle>
            </CardHeaderText>
          </CardHeader>
          <DefinitionGrid columns="stacked">
            <DefinitionTerm>Name</DefinitionTerm>
            <DefinitionValue mb="2">{name ?? '—'}</DefinitionValue>
            <DefinitionTerm>Email</DefinitionTerm>
            <DefinitionValue>{user?.email ?? '—'}</DefinitionValue>
          </DefinitionGrid>
        </Card>
      </OverviewGrid>
    </OverviewPage>
  )
}
