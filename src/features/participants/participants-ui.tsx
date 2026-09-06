import { Check } from 'lucide-react'
import { styled } from '../../../styled-system/jsx'

export const AdmissionBadge = styled('span', {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1',
    fontSize: 'xs',
    fontWeight: 'semibold',
    borderRadius: 'full',
    px: '2.5',
    py: '1',
    textTransform: 'capitalize',
  },
  variants: {
    admissionStatus: {
      pending: { bg: 'bg.sunken', color: 'text.primary' },
      // Gray like the eligible badge — the green check icon carries the
      // "approved" meaning instead of a saturated badge color.
      approved: { bg: 'bg.sunken', color: 'text.muted' },
      revoked: { bg: 'red.700', color: 'red.50' },
    },
  },
})

export const ApprovedIcon = styled(Check, {
  base: { color: 'green.600', flexShrink: '0' },
})

export const EligibilityBadge = styled('span', {
  base: {
    fontSize: 'xs',
    fontWeight: 'semibold',
    borderRadius: 'full',
    px: '2.5',
    py: '1',
    textTransform: 'capitalize',
  },
  variants: {
    eligibilityStatus: {
      eligible: { bg: 'bg.sunken', color: 'text.muted' },
      disqualified: { bg: 'red.700', color: 'red.50' },
      withdrawn: { bg: 'bg.sunken', color: 'text.muted' },
    },
  },
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
