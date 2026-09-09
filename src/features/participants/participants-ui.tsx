import { Check } from 'lucide-react'
import { styled } from '../../../styled-system/jsx'
import type { AdmissionStatus, ParticipantEligibilityStatus } from './types'

type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning'

// Admission stays quiet until something is wrong: an approved participant is
// carried by the green check icon rather than a saturated pill, and only a
// revoked one needs to shout.
export const ADMISSION_TONE: Record<AdmissionStatus, BadgeTone> = {
  pending: 'warning',
  approved: 'neutral',
  revoked: 'danger',
}

export const ELIGIBILITY_TONE: Record<ParticipantEligibilityStatus, BadgeTone> = {
  eligible: 'neutral',
  disqualified: 'danger',
  withdrawn: 'neutral',
}

export const ApprovedIcon = styled(Check, {
  base: { color: 'green.600', flexShrink: '0' },
})

export const ParticipantListEl = styled('div', {
  base: { display: 'flex', flexDirection: 'column', gap: '2' },
})

export const ParticipantListItem = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '3',
    flexWrap: 'wrap',
    bg: 'bg.surface',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'control',
    px: '3',
    py: '2.5',
  },
})

export const ParticipantIdentity = styled('div', {
  base: { display: 'flex', alignItems: 'baseline', gap: '1.5' },
})

// Badges and action buttons share one row — now that buttons have a
// squarer shape than the pill badges, they no longer read as more badges.
export const ParticipantActions = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: '2',
  },
})

export const ParticipantName = styled('span', {
  base: { fontSize: 'sm', fontWeight: 'medium' },
})

export const ParticipantMeta = styled('span', {
  base: { fontSize: 'xs', color: 'text.muted' },
})
