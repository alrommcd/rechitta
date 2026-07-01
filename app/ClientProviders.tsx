'use client'

import dynamic from 'next/dynamic'

const OrbCanvas = dynamic(() => import('@/components/OrbCanvas'), {
  ssr: false,
  loading: () => null,
})

export function ClientProviders() {
  return <OrbCanvas />
}
