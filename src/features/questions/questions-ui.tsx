import { styled } from '../../../styled-system/jsx'
import { Input } from '../auth/auth-ui'
import { CheckboxField } from '../events/events-ui'

export const AcceptableAnswerField = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '3',
    flex: '1 1 16rem',
    minWidth: '0',
  },
})

export const AcceptableAnswerInput = styled(Input, {
  base: {
    flex: '1 1 auto',
    minWidth: '0',
    width: 'auto',
  },
})

export const InlineCheckboxField = styled(CheckboxField, {
  base: {
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
})

export const AcceptableAnswerList = styled('ul', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2',
    listStyle: 'none',
    p: 0,
    m: 0,
  },
})

export const AcceptableAnswerItem = styled('li', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '3',
    bg: 'bg.surface',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'control',
    px: '3',
    py: '2.5',
  },
})

export const AcceptableAnswerText = styled('span', {
  base: {
    fontSize: 'md',
    fontWeight: 'bold',
    color: 'text.primary',
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
})

export const AcceptableAnswerMeta = styled('span', {
  base: {
    fontWeight: 'normal',
    color: 'text.muted',
  },
})

export const RemoveAnswerButton = styled('button', {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: '7',
    height: '7',
    borderRadius: 'control',
    border: 'none',
    bg: 'transparent',
    color: 'salmon.600',
    cursor: 'pointer',
    _hover: { bg: 'salmon.50', color: 'salmon.700' },
    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'accent.default',
      outlineOffset: '2px',
    },
  },
})
