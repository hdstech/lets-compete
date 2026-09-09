import { useState } from 'react'
import type { ReactNode } from 'react'
import { BreadcrumbContext } from './breadcrumb-context'
import type { Crumb } from './breadcrumb-context'

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([])
  const [dirty, setDirty] = useState(false)

  return (
    <BreadcrumbContext.Provider value={{ crumbs, setCrumbs, dirty, setDirty }}>
      {children}
    </BreadcrumbContext.Provider>
  )
}
