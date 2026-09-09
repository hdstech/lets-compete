import { styled } from '../../../styled-system/jsx'

// Shared page/card heading pair — events-ui's PageTitle/PageSubtitle and
// auth-ui's AuthTitle/AuthSubtitle were byte-for-byte identical recipes.
// `page` is the display size a screen opens with; `card` is the quieter
// version for a heading inside a card (the auth forms, dialogs).
export const Title = styled('h1', {
  base: {
    fontWeight: 'bold',
    letterSpacing: '-0.02em',
    overflowWrap: 'anywhere',
    textWrap: 'balance',
  },
  variants: {
    size: {
      page: { fontSize: { base: '2xl', sm: '3xl' } },
      card: { fontSize: 'xl' },
    },
  },
  defaultVariants: { size: 'page' },
})

export const Subtitle = styled('p', {
  base: { fontSize: 'sm', color: 'text.muted', maxWidth: '68ch' },
})
