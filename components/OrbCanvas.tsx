'use client'

import { Canvas } from '@react-three/fiber'
import { View } from '@react-three/drei'

export default function OrbCanvas() {
  return (
    <Canvas
      gl={{ alpha: true, premultipliedAlpha: false, antialias: false, powerPreference: 'high-performance' }}
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 9998,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0)
      }}
    >
      <View.Port />
    </Canvas>
  )
}
