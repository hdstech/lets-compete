import type { ReactNode } from 'react'
import { styled } from '../../../styled-system/jsx'
import {
  BrandGlow,
  BrandGrid,
  BrandHeadline,
  BrandSurface,
} from './brand-surface'

const HeaderSubtitle = styled('p', {
  base: {
    fontSize: 'sm',
    color: 'rgba(255, 255, 255, 0.85)',
  },
})

const HeaderMeta = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '2',
  },
})

export function PlayerHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  /** Status pills or other meta shown under the title. */
  children?: ReactNode
}) {
  return (
    <BrandSurface layout="banner">
      <BrandGlow placement="trailing" />
      <BrandGrid />
      <div>
        <BrandHeadline size="banner">{title}</BrandHeadline>
        {subtitle && <HeaderSubtitle>{subtitle}</HeaderSubtitle>}
      </div>
      {children && <HeaderMeta>{children}</HeaderMeta>}
    </BrandSurface>
  )
}
