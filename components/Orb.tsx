'use client'

import { type CSSProperties } from 'react'
import { View } from '@react-three/drei'
import { OrbScene } from './OrbScene'

interface OrbProps {
  size?: number | string
  count?: number
  style?: CSSProperties
  className?: string
  onClick?: () => void
}

export default function Orb({ size = 280, count = 4500, style, className, onClick }: OrbProps) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        position: 'relative',
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {/* View tracks its own DOM element — avoids React 19 ref type mismatch */}
      <View style={{ position: 'absolute', inset: 0 }}>
        <OrbScene count={count} />
      </View>
    </div>
  )
}
