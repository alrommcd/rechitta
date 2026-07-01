'use client'

import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'

const vertexShader = `
uniform float uTime;
attribute vec3 aColor;
attribute float aSize;
varying vec3 vColor;

void main() {
  vColor = aColor;
  float phase = dot(position, vec3(1.7, 2.3, 1.1));
  float shimmer = sin(uTime * 0.9 + phase * 3.14159) * 0.018;
  vec3 pos = position + normalize(position) * shimmer;
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = aSize * 2.8;
  gl_Position = projectionMatrix * mvPosition;
}
`

const fragmentShader = `
varying vec3 vColor;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float r = length(uv);
  if (r > 0.5) discard;
  float alpha = smoothstep(0.5, 0.0, r) * 0.88;
  gl_FragColor = vec4(vColor, alpha);
}
`

export function OrbScene({ count = 4500 }: { count?: number }) {
  const meshRef = useRef<THREE.Points>(null)
  const timeRef = useRef(0)

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors    = new Float32Array(count * 3)
    const sizes     = new Float32Array(count)

    const PHI = (1 + Math.sqrt(5)) / 2
    const top  = new THREE.Color('#FF2DAE')
    const mid  = new THREE.Color('#9C27B0')
    const bot  = new THREE.Color('#5B21B6')

    for (let i = 0; i < count; i++) {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / count)
      const theta = 2 * Math.PI * i / PHI
      const r     = 1.0 + (Math.random() - 0.5) * 0.18

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi)
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)

      // t=1 → top (hot-pink), t=0 → bottom (blue-violet)
      const t = (Math.cos(phi) + 1) / 2
      const c = t > 0.5
        ? new THREE.Color().lerpColors(mid, top, (t - 0.5) * 2)
        : new THREE.Color().lerpColors(bot, mid, t * 2)

      colors[i * 3]     = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b

      sizes[i] = 0.8 + Math.random() * 1.4
    }

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3))
    g.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1))

    const m = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    })

    return { geometry: g, material: m }
  }, [count])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    timeRef.current += delta
    material.uniforms.uTime.value = timeRef.current
    meshRef.current.rotation.y += delta * 0.07
    meshRef.current.rotation.x  = Math.sin(timeRef.current * 0.2) * 0.08
    meshRef.current.position.y   = Math.sin(timeRef.current * 0.45) * 0.07
  })

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 3.2]} fov={42} near={0.1} far={100} />
      <points ref={meshRef} geometry={geometry} material={material} />
    </>
  )
}
