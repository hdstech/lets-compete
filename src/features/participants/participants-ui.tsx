import { styled } from '../../../styled-system/jsx'

export const AdmissionBadge = styled('span', {
  base: {
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
      approved: { bg: 'green.700', color: 'green.50' },
      revoked: { bg: 'red.700', color: 'red.50' },
    },
  },
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
  base: { display: 'flex', flexDirection: 'column', gap: '0.5' },
})

// Stacks the status badges above the action buttons instead of running them
// together in one row — the buttons previously sat directly beside the
// badges at a similar pill shape/size, reading as more badges rather than
// actionable controls.
export const ParticipantActions = styled('div', {
  base: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1.5' },
})

export const ParticipantName = styled('span', {
  base: { fontSize: 'sm', fontWeight: 'medium' },
})

export const ParticipantMeta = styled('span', {
  base: { fontSize: 'xs', color: 'text.muted' },
})
