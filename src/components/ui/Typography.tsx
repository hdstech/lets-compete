import { styled } from '../../../styled-system/jsx'

// Shared page/card heading pair — events-ui's PageTitle/PageSubtitle and
// auth-ui's AuthTitle/AuthSubtitle were byte-for-byte identical recipes.
export const Title = styled('h1', {
  base: { fontSize: 'xl', fontWeight: 'semibold' },
})

export const Subtitle = styled('p', {
  base: { fontSize: 'sm', color: 'text.muted' },
})
