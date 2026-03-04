'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import type * as ThreeTypes from 'three'
import { STORAGE_BASE } from '@/lib/data/sinners'

type ExtractResult = 'ego' | '000' | '00' | '0'

const RESULT_LABELS: Record<ExtractResult, string> = {
  ego: 'E.G.O',
  '000': '★★★',
  '00': '★★',
  '0': '★',
}
const RESULT_COLORS: Record<ExtractResult, string> = {
  ego: '#ff4444',
  '000': '#ffd040',
  '00': '#c0c0c0',
  '0': '#8a7050',
}
const RESULT_RARITY_IMG: Record<ExtractResult, string | null> = {
  ego: null,
  '000': `${STORAGE_BASE}/icons/Rarity/3star.webp`,
  '00': `${STORAGE_BASE}/icons/Rarity/2star.webp`,
  '0': `${STORAGE_BASE}/icons/Rarity/1star.webp`,
}
const RESULT_PRIORITY: Record<ExtractResult, number> = {
  ego: 3, '000': 2, '00': 1, '0': 0,
}

function cryptoRandom(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] / (0xFFFFFFFF + 1)  // 0 ~ 0.999...
}

function rollSingle(): ExtractResult {
  const r = cryptoRandom() * 100
  if (r < 1.3) return 'ego'
  if (r < 1.3 + 2.9) return '000'
  if (r < 1.3 + 2.9 + 12.8) return '00'
  return '0'
}

/** 10번째는 1성 없음: EGO 1.3%, 3성 2.9%, 2성 95.8% */
function rollGuaranteed(): ExtractResult {
  const r = cryptoRandom() * 100
  if (r < 1.3) return 'ego'
  if (r < 1.3 + 2.9) return '000'
  return '00'
}

function roll10(): ExtractResult[] {
  const first9 = Array.from({ length: 9 }, () => rollSingle())
  return [...first9, rollGuaranteed()]
}

/** 10연뽑 중 최고 등급 — 금색 연출 판정용 */
function bestResult(results: ExtractResult[]): ExtractResult {
  return results.reduce((best, r) =>
    RESULT_PRIORITY[r] > RESULT_PRIORITY[best] ? r : best
  )
}

export default function ExtractionScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showRates, setShowRates] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'extracting' | 'done'>('idle')
  const [results, setResults] = useState<ExtractResult[] | null>(null)
  const phaseRef = useRef(phase)
  const bestRef = useRef<ExtractResult | null>(null)
  const extractTimeRef = useRef(0)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { bestRef.current = results ? bestResult(results) : null }, [results])

  useEffect(() => {
    if (!containerRef.current) return
    let disposed = false

    async function init() {
      const THREE = await import('three')
      const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js')
      const { RenderPass } = await import('three/examples/jsm/postprocessing/RenderPass.js')
      const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js')

      if (disposed || !containerRef.current) return

      // ── Scene ──
      const scene = new THREE.Scene()
      scene.background = new THREE.Color('#030201')

      const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200)
      camera.position.set(0, 0, 9)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.0
      containerRef.current.appendChild(renderer.domElement)

      // ── Post-processing ──
      const composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        2.0, 0.4, 0.2,
      )
      bloomPass.threshold = 0.15
      bloomPass.strength = 1.2
      bloomPass.radius = 0.6
      composer.addPass(bloomPass)

      // ── Lights ──
      scene.add(new THREE.AmbientLight(0x201008, 0.8))
      const centerLight = new THREE.PointLight(0xe8a020, 3, 25)
      scene.add(centerLight)
      const fillLight = new THREE.PointLight(0xc06010, 1.5, 20)
      fillLight.position.set(3, 2, -2)
      scene.add(fillLight)
      const backLight = new THREE.PointLight(0x804010, 1, 15)
      backLight.position.set(-3, -1, -3)
      scene.add(backLight)

      // Pre-allocated colors (gold / red paths)
      const goldA = new THREE.Color(0xffd040)
      const goldB = new THREE.Color(0xfff0a0)
      const redA = new THREE.Color(0xa82515)
      const redB = new THREE.Color(0xcc3020)
      const neutralA = new THREE.Color(0x804020)
      const tmpColor = new THREE.Color()

      // ═══════════════════════════════════════════════════
      // ── FRAGMENT SPHERE (파편 구체) ──
      // ═══════════════════════════════════════════════════
      const FRAG_COUNT = 400
      const fragGeo = new THREE.BoxGeometry(0.13, 0.13, 0.025)
      const fragMat = new THREE.MeshStandardMaterial({
        color: 0x886030,
        metalness: 0.95,
        roughness: 0.2,
        emissive: 0x3a1808,
        emissiveIntensity: 0.5,
      })

      const fragMesh = new THREE.InstancedMesh(fragGeo, fragMat, FRAG_COUNT)
      fragMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

      type FragInfo = {
        basePos: ThreeTypes.Vector3
        baseQuat: ThreeTypes.Quaternion
        offset: number
        sx: number
        sy: number
        sz: number
        baseR: number
        baseG: number
        baseB: number
      }
      const fragData: FragInfo[] = []
      const fragDummy = new THREE.Object3D()

      for (let i = 0; i < FRAG_COUNT; i++) {
        const y = 1 - (2 * i / (FRAG_COUNT - 1))
        const r = Math.sqrt(1 - y * y)
        const theta = Math.PI * (1 + Math.sqrt(5)) * i
        const dir = new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)).normalize()

        const sphereR = 1.1 + (Math.random() - 0.5) * 0.3
        const pos = dir.clone().multiplyScalar(sphereR)

        fragDummy.position.copy(pos)
        fragDummy.lookAt(pos.clone().multiplyScalar(2))
        fragDummy.rotateX((Math.random() - 0.5) * 0.9)
        fragDummy.rotateY((Math.random() - 0.5) * 0.9)
        fragDummy.rotateZ(Math.random() * Math.PI)

        const sx = 0.5 + Math.random() * 1.3
        const sy = 0.5 + Math.random() * 1.3
        const sz = 0.4 + Math.random() * 1.0
        fragDummy.scale.set(sx, sy, sz)
        fragDummy.updateMatrix()
        fragMesh.setMatrixAt(i, fragDummy.matrix)

        const brightness = 0.35 + Math.random() * 0.65
        fragData.push({
          basePos: pos.clone(),
          baseQuat: fragDummy.quaternion.clone(),
          offset: Math.random() * Math.PI * 2,
          sx, sy, sz,
          baseR: brightness * 0.85,
          baseG: brightness * 0.5,
          baseB: brightness * 0.18,
        })
      }

      const fragColors = new Float32Array(FRAG_COUNT * 3)
      for (let i = 0; i < FRAG_COUNT; i++) {
        fragColors[i * 3] = fragData[i].baseR
        fragColors[i * 3 + 1] = fragData[i].baseG
        fragColors[i * 3 + 2] = fragData[i].baseB
      }
      fragMesh.instanceColor = new THREE.InstancedBufferAttribute(fragColors, 3)
      scene.add(fragMesh)

      // Inner glowing core
      const coreGeo = new THREE.SphereGeometry(0.85, 32, 32)
      const coreMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uExtract: { value: 0 },
          uGold: { value: 0 },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vWorldPos;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uExtract;
          uniform float uGold;
          varying vec3 vNormal;
          varying vec3 vWorldPos;

          float hash(vec3 p) {
            p = fract(p * vec3(443.897, 441.423, 437.195));
            p += dot(p, p.yzx + 19.19);
            return fract((p.x + p.y) * p.z);
          }
          float noise3d(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
                  mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
              mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                  mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y),
              f.z);
          }

          void main() {
            float n = noise3d(vWorldPos * 3.0 + uTime * 0.5);
            float n2 = noise3d(vWorldPos * 6.0 - uTime * 0.3);
            float pattern = smoothstep(0.3, 0.7, n) * smoothstep(0.35, 0.65, n2);

            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);

            // Red path colors
            vec3 rBase = vec3(0.12, 0.03, 0.02);
            vec3 rGlow = vec3(0.7, 0.12, 0.05);
            vec3 rHot  = vec3(1.0, 0.3, 0.1);
            // Gold path colors
            vec3 gBase = vec3(0.12, 0.06, 0.02);
            vec3 gGlow = vec3(0.9, 0.5, 0.08);
            vec3 gHot  = vec3(1.0, 0.85, 0.35);

            vec3 baseCol = mix(rBase, gBase, uGold);
            vec3 glowCol = mix(rGlow, gGlow, uGold);
            vec3 hotCol  = mix(rHot, gHot, uGold);

            vec3 col = mix(baseCol, glowCol, pattern * 0.6 + fresnel * 0.3);
            col += hotCol * fresnel * (0.25 + uExtract * 1.0);
            col += glowCol * pattern * uExtract * 0.6;

            float alpha = 0.75 + fresnel * 0.25 + uExtract * 0.25;
            gl_FragColor = vec4(col, min(1.0, alpha));
          }
        `,
        transparent: true,
      })
      const coreSphere = new THREE.Mesh(coreGeo, coreMat)
      scene.add(coreSphere)

      // Outer glow halo
      const haloGeo = new THREE.SphereGeometry(1.5, 24, 24)
      const haloMat = new THREE.ShaderMaterial({
        uniforms: {
          uExtract: { value: 0 },
          uGold: { value: 0 },
        },
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uExtract;
          uniform float uGold;
          varying vec3 vNormal;
          void main() {
            vec3 viewDir = vec3(0.0, 0.0, 1.0);
            float rim = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 5.0);
            vec3 rCol = vec3(0.7, 0.12, 0.05);
            vec3 gCol = vec3(0.9, 0.55, 0.08);
            vec3 col = mix(rCol, gCol, uGold);
            float alpha = rim * (0.1 + uExtract * 0.5);
            gl_FragColor = vec4(col, alpha);
          }
        `,
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const halo = new THREE.Mesh(haloGeo, haloMat)
      scene.add(halo)

      // ═══════════════════════════════════════════════════
      // ── CHAINS (사슬) — 실제 체인처럼 인터록킹 ──
      // ═══════════════════════════════════════════════════
      const CHAIN_COUNT = 10
      const LINKS_PER_CHAIN = 30
      const TOTAL_LINKS = CHAIN_COUNT * LINKS_PER_CHAIN
      const LINK_SPACING = 0.18   // 링크 간 중심 거리 (인터록킹용)
      const SPHERE_R = 1.3        // 사슬 시작 반지름

      // 더 크고 두꺼운 토러스 링크
      const linkGeo = new THREE.TorusGeometry(0.11, 0.038, 12, 16)
      const linkMat = new THREE.MeshStandardMaterial({
        color: 0xa08050,
        metalness: 0.92,
        roughness: 0.15,
        emissive: 0x402010,
        emissiveIntensity: 0.4,
      })

      const chainMesh = new THREE.InstancedMesh(linkGeo, linkMat, TOTAL_LINKS)
      chainMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      scene.add(chainMesh)

      const chainColors = new Float32Array(TOTAL_LINKS * 3)
      for (let i = 0; i < TOTAL_LINKS; i++) {
        chainColors[i * 3] = 0.6 + Math.random() * 0.3
        chainColors[i * 3 + 1] = 0.38 + Math.random() * 0.15
        chainColors[i * 3 + 2] = 0.12 + Math.random() * 0.1
      }
      chainMesh.instanceColor = new THREE.InstancedBufferAttribute(chainColors, 3)

      type ChainPath = {
        direction: ThreeTypes.Vector3
        perpA: ThreeTypes.Vector3
        perpB: ThreeTypes.Vector3
        phase: number
      }
      const chainPaths: ChainPath[] = []

      for (let i = 0; i < CHAIN_COUNT; i++) {
        const y = 1 - (2 * i / (CHAIN_COUNT - 1))
        const r = Math.sqrt(1 - y * y)
        const theta = Math.PI * (1 + Math.sqrt(5)) * i
        const dir = new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)).normalize()

        const up = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
        const perpA = new THREE.Vector3().crossVectors(dir, up).normalize()
        const perpB = new THREE.Vector3().crossVectors(dir, perpA).normalize()

        chainPaths.push({
          direction: dir, perpA, perpB,
          phase: (i / CHAIN_COUNT) * Math.PI * 2,
        })
      }

      const linkDummy = new THREE.Object3D()
      const linkTQ = new THREE.Quaternion()
      const chainEndpoints = Array.from({ length: CHAIN_COUNT }, () => new THREE.Vector3())

      // 사슬 하나씩 순차 뻗어나가기
      const CHAIN_START_EP = 0.12
      const CHAIN_STAGGER = 0.015  // 사슬 간 간격 — 매우 빠르게 연달아
      const CHAIN_EXTEND_DUR = 0.05 // 각 사슬 뻗는 시간 — 순식간

      function updateChains(time: number, ep: number, gf: number) {
        for (let ci = 0; ci < CHAIN_COUNT; ci++) {
          const p = chainPaths[ci]
          const myStart = CHAIN_START_EP + ci * CHAIN_STAGGER
          const chainEp = Math.min(1, Math.max(0, (ep - myStart) / CHAIN_EXTEND_DUR))

          for (let li = 0; li < LINKS_PER_CHAIN; li++) {
            const idx = ci * LINKS_PER_CHAIN + li
            const dist = li * LINK_SPACING // 고정 간격

            // ── WRAP: 구체 표면에 감긴 상태 ──
            // 고정 간격으로 구체 표면 나선을 따라 배치
            const wrapAngle = (dist / SPHERE_R) * 1.2 + p.phase + time * 0.15
            const wrapPos = new THREE.Vector3()
            wrapPos.addScaledVector(p.perpA, Math.cos(wrapAngle) * SPHERE_R)
            wrapPos.addScaledVector(p.perpB, Math.sin(wrapAngle) * SPHERE_R)
            // 약간 바깥으로 떠있게 (겹침 방지)
            wrapPos.addScaledVector(p.direction, (dist * 0.08))
            wrapPos.normalize().multiplyScalar(SPHERE_R + 0.05 + li * 0.003)

            // ── EXTEND: 직선으로 뻗어나감 ──
            const extendDist = SPHERE_R + dist
            const extendPos = p.direction.clone().multiplyScalar(extendDist)

            // 블렌드
            const pos = wrapPos.clone().lerp(extendPos, chainEp)

            // Idle 미세 흔들림
            const wobble = (1 - chainEp) * 0.01
            pos.x += Math.sin(time * 2 + li * 1.5 + p.phase) * wobble
            pos.y += Math.cos(time * 1.7 + li * 1.3) * wobble

            linkDummy.position.copy(pos)

            // ── ROTATION: 사슬 방향 따라 + 교차 인터록킹 ──
            const tangent = chainEp > 0.3
              ? p.direction.clone()
              : (() => {
                  // 다음 링크 위치로의 접선
                  const nextAngle = ((dist + LINK_SPACING) / SPHERE_R) * 1.2 + p.phase + time * 0.15
                  const nextP = new THREE.Vector3()
                  nextP.addScaledVector(p.perpA, Math.cos(nextAngle) * SPHERE_R)
                  nextP.addScaledVector(p.perpB, Math.sin(nextAngle) * SPHERE_R)
                  nextP.addScaledVector(p.direction, ((dist + LINK_SPACING) * 0.08))
                  nextP.normalize().multiplyScalar(SPHERE_R + 0.05)
                  const t = nextP.sub(wrapPos)
                  return t.lengthSq() > 0.0001 ? t.normalize() : p.direction.clone()
                })()

            // 기본 방향: tangent을 따라 정렬
            linkDummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent.normalize())
            // 홀수/짝수 링크 90° 교차 → 실제 체인 인터록킹
            if (li % 2 === 0) {
              linkTQ.setFromAxisAngle(tangent, Math.PI / 2)
              linkDummy.quaternion.multiply(linkTQ)
            }

            linkDummy.scale.setScalar(1)
            linkDummy.updateMatrix()
            chainMesh.setMatrixAt(idx, linkDummy.matrix)

            // 색상: 금색/빨강 틴트
            const glow = ep * Math.max(0, Math.sin(time * 4 - li * 0.5 + ci))
            chainColors[idx * 3] = 0.6 + glow * (0.2 + gf * 0.2)
            chainColors[idx * 3 + 1] = 0.38 * (0.3 + gf * 0.7) + glow * gf * 0.35
            chainColors[idx * 3 + 2] = 0.12 * (0.5 + gf * 0.5) + glow * gf * 0.2

            if (li === LINKS_PER_CHAIN - 1) chainEndpoints[ci].copy(pos)
          }
        }
        chainMesh.instanceMatrix.needsUpdate = true
        if (chainMesh.instanceColor) chainMesh.instanceColor.needsUpdate = true
        ;(linkMat as ThreeTypes.MeshStandardMaterial).emissiveIntensity = 0.4 + ep * 3.5
      }

      // ═══════════════════════════════════════════════════
      // ── ENDPOINT FIRE BURSTS (사슬 끝 대폭발) ──
      // ═══════════════════════════════════════════════════
      const FIRE_PER_CHAIN = 100
      const TOTAL_FIRE = CHAIN_COUNT * FIRE_PER_CHAIN
      const fireGeo = new THREE.BufferGeometry()
      const firePos = new Float32Array(TOTAL_FIRE * 3)
      const fireSz = new Float32Array(TOTAL_FIRE)
      const fireAl = new Float32Array(TOTAL_FIRE)
      const fireVel = new Float32Array(TOTAL_FIRE * 3)
      const fireLife = new Float32Array(TOTAL_FIRE)

      for (let i = 0; i < TOTAL_FIRE; i++) {
        firePos[i * 3 + 1] = 200
        fireSz[i] = 3 + Math.random() * 10
        fireAl[i] = 0
        fireLife[i] = -1
      }
      fireGeo.setAttribute('position', new THREE.BufferAttribute(firePos, 3))
      fireGeo.setAttribute('aSize', new THREE.BufferAttribute(fireSz, 1))
      fireGeo.setAttribute('aAlpha', new THREE.BufferAttribute(fireAl, 1))

      const fireMat = new THREE.ShaderMaterial({
        uniforms: {
          uPR: { value: renderer.getPixelRatio() },
          uGold: { value: 0 },
        },
        vertexShader: `
          attribute float aSize; attribute float aAlpha;
          uniform float uPR;
          varying float vA;
          void main() {
            vA = aAlpha;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aSize * uPR * (120.0 / -mv.z);
          }
        `,
        fragmentShader: `
          uniform float uGold;
          varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5) discard;
            float glow = smoothstep(0.5, 0.0, d);
            float core = smoothstep(0.15, 0.0, d);
            // Red path
            vec3 rOuter = vec3(0.75, 0.1, 0.03);
            vec3 rMid   = vec3(0.9, 0.2, 0.05);
            vec3 rHot   = vec3(1.0, 0.45, 0.2);
            // Gold path
            vec3 gOuter = vec3(0.85, 0.28, 0.04);
            vec3 gMid   = vec3(1.0, 0.65, 0.12);
            vec3 gHot   = vec3(1.0, 0.95, 0.7);

            vec3 outer = mix(rOuter, gOuter, uGold);
            vec3 mid   = mix(rMid, gMid, uGold);
            vec3 hot   = mix(rHot, gHot, uGold);

            vec3 col = mix(outer, mid, glow);
            col = mix(col, hot, core);
            gl_FragColor = vec4(col, glow * vA);
          }
        `,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      })
      const fireP = new THREE.Points(fireGeo, fireMat)
      fireP.visible = false
      scene.add(fireP)

      let fireNext = 0
      function updateFire(dt: number, ep: number) {
        if (ep < 0.25) { fireP.visible = false; return }
        fireP.visible = true
        const intensity = Math.min(1, (ep - 0.25) / 0.5)

        for (let ci = 0; ci < CHAIN_COUNT; ci++) {
          const emit = Math.floor(intensity * 6)
          const endP = chainEndpoints[ci]
          for (let e = 0; e < emit; e++) {
            const i = fireNext % TOTAL_FIRE
            fireNext++
            firePos[i * 3] = endP.x + (Math.random() - 0.5) * 0.8
            firePos[i * 3 + 1] = endP.y + (Math.random() - 0.5) * 0.8
            firePos[i * 3 + 2] = endP.z + (Math.random() - 0.5) * 0.8
            const dir = endP.clone().normalize()
            const sp = 0.5 + Math.random() * 3 * intensity
            fireVel[i * 3] = dir.x * sp + (Math.random() - 0.5) * 1.5
            fireVel[i * 3 + 1] = dir.y * sp + (Math.random() - 0.5) * 1.5 + 0.3
            fireVel[i * 3 + 2] = dir.z * sp + (Math.random() - 0.5) * 1.5
            fireLife[i] = 0.6 + Math.random() * 1.0
            fireAl[i] = 0.7 + Math.random() * 0.3
            fireSz[i] = 5 + Math.random() * 18 * intensity
          }
        }

        for (let i = 0; i < TOTAL_FIRE; i++) {
          if (fireLife[i] <= 0) { fireAl[i] = 0; continue }
          fireLife[i] -= dt
          firePos[i * 3] += fireVel[i * 3] * dt
          firePos[i * 3 + 1] += fireVel[i * 3 + 1] * dt
          firePos[i * 3 + 2] += fireVel[i * 3 + 2] * dt
          fireVel[i * 3] *= 0.95
          fireVel[i * 3 + 1] *= 0.95
          fireVel[i * 3 + 2] *= 0.95
          fireAl[i] = Math.min(1, fireLife[i] * 2) * intensity
          fireSz[i] *= 1.008
        }
        fireGeo.attributes.position.needsUpdate = true
        ;(fireGeo.attributes.aAlpha as ThreeTypes.BufferAttribute).needsUpdate = true
        ;(fireGeo.attributes.aSize as ThreeTypes.BufferAttribute).needsUpdate = true
      }

      // ═══════════════════════════════════════════════════
      // ── AMBIENT SPARKS (배경 금색 입자) ──
      // ═══════════════════════════════════════════════════
      const SPARK_COUNT = 300
      const sparkGeo = new THREE.BufferGeometry()
      const sparkPos = new Float32Array(SPARK_COUNT * 3)
      const sparkSz = new Float32Array(SPARK_COUNT)

      for (let i = 0; i < SPARK_COUNT; i++) {
        const a = Math.random() * Math.PI * 2
        const r = 1.5 + Math.random() * 8
        sparkPos[i * 3] = Math.cos(a) * r
        sparkPos[i * 3 + 1] = (Math.random() - 0.5) * 6
        sparkPos[i * 3 + 2] = Math.sin(a) * r
        sparkSz[i] = 1 + Math.random() * 3.5
      }
      sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3))
      sparkGeo.setAttribute('aSize', new THREE.BufferAttribute(sparkSz, 1))

      const sparkMat = new THREE.ShaderMaterial({
        uniforms: {
          uPR: { value: renderer.getPixelRatio() },
          uGold: { value: 0 },
        },
        vertexShader: `
          attribute float aSize;
          uniform float uPR;
          varying float vAlpha;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aSize * uPR * (60.0 / -mv.z);
            vAlpha = smoothstep(10.0, 1.0, length(position)) * 0.5;
          }
        `,
        fragmentShader: `
          uniform float uGold;
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5) discard;
            float g = smoothstep(0.5, 0.0, d);
            vec3 rCol = mix(vec3(0.5, 0.15, 0.05), vec3(0.9, 0.3, 0.1), g);
            vec3 gCol = mix(vec3(0.65, 0.35, 0.08), vec3(1.0, 0.85, 0.5), g);
            vec3 col = mix(rCol, gCol, uGold);
            gl_FragColor = vec4(col, g * vAlpha);
          }
        `,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      })
      const sparks = new THREE.Points(sparkGeo, sparkMat)
      scene.add(sparks)

      // ═══════════════════════════════════════════════════
      // ── CENTER BURST PARTICLES (중심 방출) ──
      // ═══════════════════════════════════════════════════
      const CP_COUNT = 500
      const cpGeo = new THREE.BufferGeometry()
      const cpPos = new Float32Array(CP_COUNT * 3)
      const cpSz = new Float32Array(CP_COUNT)
      const cpAl = new Float32Array(CP_COUNT)
      const cpVel = new Float32Array(CP_COUNT * 3)
      const cpLife = new Float32Array(CP_COUNT)

      for (let i = 0; i < CP_COUNT; i++) {
        cpPos[i * 3 + 1] = 200
        cpSz[i] = 2 + Math.random() * 5
        cpAl[i] = 0
        cpLife[i] = -1
      }
      cpGeo.setAttribute('position', new THREE.BufferAttribute(cpPos, 3))
      cpGeo.setAttribute('aSize', new THREE.BufferAttribute(cpSz, 1))
      cpGeo.setAttribute('aAlpha', new THREE.BufferAttribute(cpAl, 1))

      const cpMat = new THREE.ShaderMaterial({
        uniforms: {
          uPR: { value: renderer.getPixelRatio() },
          uGold: { value: 0 },
        },
        vertexShader: `
          attribute float aSize; attribute float aAlpha;
          uniform float uPR;
          varying float vA;
          void main() {
            vA = aAlpha;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aSize * uPR * (80.0 / -mv.z);
          }
        `,
        fragmentShader: `
          uniform float uGold;
          varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5) discard;
            float g = smoothstep(0.5, 0.0, d);
            vec3 rCol = mix(vec3(0.7, 0.15, 0.05), vec3(1.0, 0.35, 0.1), g);
            vec3 gCol = mix(vec3(0.85, 0.45, 0.08), vec3(1.0, 0.9, 0.55), g);
            vec3 col = mix(rCol, gCol, uGold);
            gl_FragColor = vec4(col, g * vA * 0.7);
          }
        `,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      })
      const cpPts = new THREE.Points(cpGeo, cpMat)
      cpPts.visible = false
      scene.add(cpPts)

      let cpNext = 0
      function updateCenterP(dt: number, ep: number) {
        if (ep < 0.08) { cpPts.visible = false; return }
        cpPts.visible = true
        const inten = Math.min(1, (ep - 0.08) / 0.7)

        const emit = Math.floor(inten * 35)
        for (let e = 0; e < emit; e++) {
          const i = cpNext % CP_COUNT
          cpNext++
          const th = Math.random() * Math.PI * 2
          const ph = Math.acos(2 * Math.random() - 1)
          const r = 1.1 + Math.random() * 0.3
          cpPos[i * 3] = Math.sin(ph) * Math.cos(th) * r
          cpPos[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * r
          cpPos[i * 3 + 2] = Math.cos(ph) * r
          const sp = 0.8 + Math.random() * 3.5 * inten
          cpVel[i * 3] = Math.sin(ph) * Math.cos(th) * sp
          cpVel[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * sp
          cpVel[i * 3 + 2] = Math.cos(ph) * sp
          cpLife[i] = 0.8 + Math.random() * 1.5
          cpAl[i] = 0.5 + Math.random() * 0.5
        }

        for (let i = 0; i < CP_COUNT; i++) {
          if (cpLife[i] <= 0) { cpAl[i] = 0; continue }
          cpLife[i] -= dt
          cpPos[i * 3] += cpVel[i * 3] * dt
          cpPos[i * 3 + 1] += cpVel[i * 3 + 1] * dt
          cpPos[i * 3 + 2] += cpVel[i * 3 + 2] * dt
          cpVel[i * 3] *= 0.97
          cpVel[i * 3 + 1] *= 0.97
          cpVel[i * 3 + 2] *= 0.97
          cpAl[i] = Math.min(1, cpLife[i] * 1.5) * inten
        }
        cpGeo.attributes.position.needsUpdate = true
        ;(cpGeo.attributes.aAlpha as ThreeTypes.BufferAttribute).needsUpdate = true
      }

      // ═══════════════════════════════════════════════════
      // ── BACKGROUND NEBULA ──
      // ═══════════════════════════════════════════════════
      const nebulaGeo = new THREE.SphereGeometry(30, 32, 32)
      const nebulaMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uExtract: { value: 0 },
          uGold: { value: 0 },
        },
        vertexShader: `
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uExtract;
          uniform float uGold;
          varying vec3 vPos;

          float hash(vec3 p) {
            p = fract(p * vec3(443.897, 441.423, 437.195));
            p += dot(p, p.yzx + 19.19);
            return fract((p.x + p.y) * p.z);
          }
          float noise3d(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
                  mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
              mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                  mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y),
              f.z);
          }

          void main() {
            vec3 dir = normalize(vPos);
            float n = noise3d(dir * 2.0 + uTime * 0.02);
            float n2 = noise3d(dir * 4.0 - uTime * 0.03);
            float nebula = smoothstep(0.35, 0.65, n) * smoothstep(0.3, 0.7, n2);

            vec3 rCol = vec3(0.12, 0.02, 0.01);
            vec3 gCol = vec3(0.12, 0.04, 0.01);
            vec3 rBright = vec3(0.18, 0.04, 0.01);
            vec3 gBright = vec3(0.2, 0.08, 0.02);

            vec3 baseCol = mix(rCol, gCol, uGold) * nebula;
            baseCol += mix(rBright, gBright, uGold) * pow(nebula, 2.0) * (0.5 + uExtract);

            float alpha = nebula * (0.15 + uExtract * 0.25);
            gl_FragColor = vec4(baseCol, alpha);
          }
        `,
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
      })
      const nebula = new THREE.Mesh(nebulaGeo, nebulaMat)
      scene.add(nebula)

      // ═══════════════════════════════════════════════════
      // ── REVEAL FLASH (띠롱 전환 플래시) ──
      // ═══════════════════════════════════════════════════
      const flashGeo = new THREE.PlaneGeometry(40, 40)
      const flashMat = new THREE.MeshBasicMaterial({
        color: 0xffd040, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      })
      const flash = new THREE.Mesh(flashGeo, flashMat)
      flash.position.z = 3
      scene.add(flash)

      // ═══════════════════════════════════════════════════
      // ── ANIMATION LOOP ──
      // ═══════════════════════════════════════════════════
      let prevTime = performance.now()
      const startTime = prevTime
      let ep = 0
      let revealFlash = 0 // 0→1→0 spike for the "띠롱" moment
      const fAnimDummy = new THREE.Object3D()

      function animate() {
        if (disposed) return
        requestAnimationFrame(animate)

        const now = performance.now()
        const dt = Math.min((now - prevTime) / 1000, 0.05)
        prevTime = now
        const t = (now - startTime) / 1000

        // Progress
        if (phaseRef.current === 'extracting') {
          extractTimeRef.current += dt
          ep = Math.min(1, extractTimeRef.current / 3.0)
        } else if (phaseRef.current === 'idle') {
          ep = Math.max(0, ep - dt * 0.4)
          extractTimeRef.current = 0
        }

        // ── Gold factor: result-based color ──
        // Reveal happens at ep 0.35~0.5 — the "띠롱" transition
        const res = bestRef.current
        const isGold = res === '000' || res === 'ego'
        let gf = 0 // gold factor: 0 = red, 1 = gold

        if (ep > 0 && res) {
          if (isGold) {
            // 색 전환: 사슬 뻗기 직전 ep 0.12~0.22에서 금색 전환
            gf = Math.min(1, Math.max(0, (ep - 0.12) / 0.1))
          } else {
            gf = 0
          }
        } else {
          // Idle: 기본색 빨강
          gf = 0
        }

        // 띠롱 플래시 (금색 전환 시)
        if (isGold && ep > 0.11 && ep < 0.3) {
          const flashProgress = (ep - 0.11) / 0.19
          revealFlash = Math.sin(flashProgress * Math.PI) * 1.0
        } else {
          revealFlash = Math.max(0, revealFlash - dt * 3)
        }

        // ── Fragment sphere ──
        const fScale = 1 + Math.sin(t * 1.5) * 0.008 + ep * 0.15
        for (let i = 0; i < FRAG_COUNT; i++) {
          const fd = fragData[i]
          const jitter = Math.sin(t * 3 + fd.offset) * 0.006 * (1 + ep * 6)
          const explode = ep > 0.65 ? (ep - 0.65) / 0.35 * 0.6 : 0

          fAnimDummy.position.copy(fd.basePos).multiplyScalar(fScale + jitter + explode * (0.3 + Math.sin(fd.offset) * 0.3))
          fAnimDummy.quaternion.copy(fd.baseQuat)
          fAnimDummy.scale.set(fd.sx, fd.sy, fd.sz)
          fAnimDummy.updateMatrix()
          fragMesh.setMatrixAt(i, fAnimDummy.matrix)

          // Color: blend between red and gold based on gf
          const glow = ep * 0.25 + Math.max(0, Math.sin(t * 2 + fd.offset)) * ep * 0.15 + revealFlash * 0.12
          // Red tint
          const rR = fd.baseR * 0.7 + glow * 0.4
          const rG = fd.baseG * 0.2 + glow * 0.08
          const rB = fd.baseB * 0.3 + glow * 0.03
          // Gold tint
          const gR = fd.baseR + glow * 0.5
          const gG = fd.baseG + glow * 0.35
          const gB = fd.baseB + glow * 0.15
          fragColors[i * 3] = Math.min(1, rR + (gR - rR) * gf)
          fragColors[i * 3 + 1] = Math.min(1, rG + (gG - rG) * gf)
          fragColors[i * 3 + 2] = Math.min(1, rB + (gB - rB) * gf)
        }
        fragMesh.instanceMatrix.needsUpdate = true
        if (fragMesh.instanceColor) (fragMesh.instanceColor as ThreeTypes.BufferAttribute).needsUpdate = true

        // Fragment emissive: red or gold
        tmpColor.lerpColors(
          new THREE.Color(0x5a1005),
          new THREE.Color(0x3a1808),
          gf,
        )
        fragMat.emissive = tmpColor.clone()
        fragMat.emissiveIntensity = 0.4 + ep * 1.5 + revealFlash * 0.6

        // Core + halo
        coreMat.uniforms.uTime.value = t
        coreMat.uniforms.uExtract.value = ep
        coreMat.uniforms.uGold.value = gf
        coreSphere.scale.setScalar(1 + ep * 0.1)
        haloMat.uniforms.uExtract.value = ep
        haloMat.uniforms.uGold.value = gf
        halo.scale.setScalar(1 + ep * 0.3)

        // Chains
        updateChains(t, ep, gf)

        // Fire (update uGold for tint)
        fireMat.uniforms.uGold.value = gf
        updateFire(dt, ep)

        // Center particles
        cpMat.uniforms.uGold.value = gf
        updateCenterP(dt, ep)

        // Sparks
        sparkMat.uniforms.uGold.value = Math.max(gf, 0.3) // sparks always slightly warm
        sparks.rotation.y += dt * 0.025

        // Nebula
        nebulaMat.uniforms.uTime.value = t
        nebulaMat.uniforms.uExtract.value = ep
        nebulaMat.uniforms.uGold.value = gf

        // Flash: reveal flash + extraction climax
        let flashOpacity = 0
        flashOpacity += revealFlash * 0.15 // 띠롱 flash
        if (ep > 0.75) {
          flashOpacity += ((ep - 0.75) / 0.25) * 0.06 * (1 + Math.sin(t * 8) * 0.3)
        }
        flashMat.opacity = Math.min(1, flashOpacity)
        flashMat.color.lerpColors(
          new THREE.Color(0xff4422),
          new THREE.Color(0xffd040),
          gf,
        )

        // Camera
        camera.position.x = Math.sin(t * 0.15) * 0.4
        camera.position.y = Math.cos(t * 0.12) * 0.3
        if (ep > 0.15) {
          const shake = (ep - 0.15) * 0.06 + revealFlash * 0.08
          camera.position.x += (Math.random() - 0.5) * shake
          camera.position.y += (Math.random() - 0.5) * shake
        }
        camera.lookAt(0, 0, 0)

        // Lights: red ↔ gold
        centerLight.intensity = 2 + ep * 4 + revealFlash * 2
        centerLight.color.lerpColors(
          tmpColor.clone().lerpColors(redA, neutralA, 0.3),
          tmpColor.clone().lerpColors(goldA, goldB, ep),
          gf,
        )
        fillLight.intensity = 1 + ep * 2 + revealFlash * 1
        fillLight.color.lerpColors(redB, goldA, gf)

        // Bloom
        bloomPass.strength = 1.2 + ep * 1.5 + revealFlash * 0.8

        composer.render()
      }

      animate()

      function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
        composer.setSize(window.innerWidth, window.innerHeight)
      }
      window.addEventListener('resize', onResize)

      return () => {
        disposed = true
        window.removeEventListener('resize', onResize)
        renderer.dispose()
        if (containerRef.current?.contains(renderer.domElement)) {
          containerRef.current.removeChild(renderer.domElement)
        }
      }
    }

    const cleanup = init()
    return () => { cleanup.then(fn => fn?.()) }
  }, [])

  const handleExtract = () => {
    if (phase === 'idle') {
      const rolled = roll10()
      setResults(rolled)
      extractTimeRef.current = 0
      setPhase('extracting')
      // 마지막 사슬 완료 직후 결과 표시
      setTimeout(() => setPhase('done'), 1400)
    } else {
      setResults(null)
      extractTimeRef.current = 0
      setPhase('idle')
    }
  }

  const best = results ? bestResult(results) : null
  const isGoldResult = best === '000' || best === 'ego'

  // 결과 요약 카운트
  const resultCounts = results ? results.reduce((acc, r) => {
    acc[r] = (acc[r] || 0) + 1
    return acc
  }, {} as Record<string, number>) : null

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#030201' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* ── 배경 딤 (결과 표시 시) ── */}
      {phase === 'done' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 15,
          background: 'radial-gradient(ellipse at center, rgba(3,2,1,0.5) 0%, rgba(3,2,1,0.85) 100%)',
          animation: 'dimFadeIn 0.4s ease-out both',
          pointerEvents: 'none',
        }} />
      )}

      {/* ── 10연뽑 결과 ── */}
      {phase === 'done' && results && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          zIndex: 20,
          animation: 'resultFadeIn 0.5s ease-out both',
        }}>
          {/* 결과 헤더 */}
          <div style={{ marginBottom: '1.25rem' }}>
            <p style={{
              fontSize: '1.1rem',
              fontFamily: 'var(--font-heading, sans-serif)',
              fontWeight: 700,
              color: best === 'ego' ? '#ff5050' : isGoldResult ? '#ffd040' : '#c8a060',
              textShadow: best === 'ego' ? '0 0 24px rgba(255,60,60,0.4), 0 0 48px rgba(255,60,60,0.15)'
                : isGoldResult ? '0 0 20px rgba(255,208,64,0.3), 0 0 40px rgba(255,208,64,0.1)' : 'none',
              letterSpacing: '0.08em',
            }}>
              {best === 'ego' ? 'E.G.O 추출 성공' :
                best === '000' ? '★★★ 인격 획득' :
                best === '00' ? '★★ 인격 획득' : '추출 완료'}
            </p>
            {/* 요약 라인 */}
            <div style={{
              marginTop: '0.5rem',
              display: 'flex', gap: '0.75rem', justifyContent: 'center',
              fontSize: '0.65rem',
              fontFamily: 'var(--font-body, sans-serif)',
              color: '#7a6a50',
            }}>
              {resultCounts && (['ego', '000', '00', '0'] as ExtractResult[]).map(key => {
                const count = resultCounts[key]
                if (!count) return null
                return (
                  <span key={key} style={{ color: `${RESULT_COLORS[key]}b0` }}>
                    {RESULT_LABELS[key]} <span style={{ fontWeight: 600 }}>×{count}</span>
                  </span>
                )
              })}
            </div>
          </div>

          {/* 결과 카드 그리드 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '0.5rem',
            padding: '1.25rem 1.5rem',
            background: 'rgba(10,8,5,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(200,144,10,0.1)',
            borderRadius: '8px',
            boxShadow: isGoldResult
              ? '0 0 40px rgba(200,144,10,0.08), inset 0 1px 0 rgba(200,144,10,0.1)'
              : 'inset 0 1px 0 rgba(255,255,255,0.03)',
          }}>
            {results.map((r, i) => {
              const isSpecial = r === 'ego' || r === '000'
              const glowColor = RESULT_COLORS[r]
              return (
                <div
                  key={i}
                  style={{
                    width: '56px', height: '68px',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: '5px',
                    position: 'relative',
                    background: r === 'ego' ? 'rgba(255,60,60,0.05)' :
                      r === '000' ? 'rgba(255,200,40,0.05)' :
                      r === '00' ? 'rgba(192,192,192,0.03)' : 'rgba(20,16,10,0.6)',
                    border: `1px solid ${glowColor}${isSpecial ? '35' : '12'}`,
                    borderRadius: '5px',
                    animation: `resultSlotReveal 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s both`,
                    boxShadow: isSpecial ? `0 0 12px ${glowColor}15, inset 0 0 8px ${glowColor}08` : 'none',
                    overflow: 'hidden',
                  }}
                >
                  {/* 상단 빛줄기 (특별 등급) */}
                  {isSpecial && (
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                      background: `linear-gradient(90deg, transparent, ${glowColor}60, transparent)`,
                    }} />
                  )}
                  {RESULT_RARITY_IMG[r] ? (
                    <div style={{ width: '30px', height: '30px', position: 'relative', flexShrink: 0 }}>
                      <Image
                        src={RESULT_RARITY_IMG[r]!}
                        alt={RESULT_LABELS[r]}
                        fill
                        sizes="30px"
                        style={{
                          objectFit: 'contain',
                          filter: isSpecial ? `drop-shadow(0 0 6px ${glowColor}50)` : 'none',
                        }}
                      />
                    </div>
                  ) : (
                    <span style={{
                      fontSize: '0.7rem',
                      fontFamily: 'var(--font-heading, sans-serif)',
                      fontWeight: 700,
                      color: glowColor,
                      textShadow: `0 0 12px ${glowColor}50`,
                    }}>
                      {RESULT_LABELS[r]}
                    </span>
                  )}
                  <span style={{
                    fontSize: '0.5rem',
                    color: `${glowColor}80`,
                    fontFamily: 'var(--font-body, sans-serif)',
                    letterSpacing: '0.02em',
                  }}>
                    {r === 'ego' ? 'E.G.O' : r === '000' ? '3성' : r === '00' ? '2성' : '1성'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 하단 버튼 영역 ── */}
      <div style={{
        position: 'absolute', bottom: '2.5rem', left: '50%', transform: 'translateX(-50%)',
        zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
      }}>
        <button
          onClick={handleExtract}
          disabled={phase === 'extracting'}
          className="extraction-btn"
          style={{
            padding: '0.75rem 3rem',
            background: phase === 'idle'
              ? 'linear-gradient(180deg, #d4a020 0%, #b08010 100%)'
              : phase === 'done'
              ? 'rgba(200,144,10,0.1)'
              : 'rgba(26,21,16,0.6)',
            color: phase === 'idle'
              ? '#0d0b08'
              : phase === 'done'
              ? '#c8a050'
              : '#5a4838',
            border: phase === 'idle'
              ? '1px solid #e0b830'
              : `1px solid rgba(200,144,10,${phase === 'done' ? '0.3' : '0.12'})`,
            borderRadius: '4px',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-heading, sans-serif)',
            fontWeight: 700,
            cursor: phase === 'extracting' ? 'default' : 'pointer',
            transition: 'all 0.3s',
            letterSpacing: '0.1em',
            boxShadow: phase === 'idle'
              ? '0 2px 16px rgba(200,144,10,0.25), inset 0 1px 0 rgba(255,255,255,0.2)'
              : 'none',
            textShadow: phase === 'idle' ? '0 1px 0 rgba(0,0,0,0.2)' : 'none',
          }}
        >
          {phase === 'idle' ? '10회 추출' : phase === 'extracting' ? '추출 중...' : '다시 추출'}
        </button>
      </div>

      {/* ── 왼쪽 하단 확률 정보 버튼 ── */}
      <button
        onClick={() => setShowRates(true)}
        style={{
          position: 'absolute', bottom: '2.5rem', left: '2rem', zIndex: 20,
          display: 'flex', alignItems: 'center', gap: '0.35rem',
          padding: '0.4rem 0.75rem',
          background: 'rgba(13,11,8,0.7)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(200,144,10,0.15)',
          borderRadius: '4px',
          color: '#8a7a60',
          fontSize: '0.65rem',
          fontFamily: 'var(--font-body, sans-serif)',
          cursor: 'pointer',
          transition: 'all 0.2s',
          letterSpacing: '0.02em',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,144,10,0.35)'
          ;(e.currentTarget as HTMLElement).style.color = '#c8a060'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,144,10,0.15)'
          ;(e.currentTarget as HTMLElement).style.color = '#8a7a60'
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
        </svg>
        확률 정보
      </button>

      {/* ── 확률 정보 모달 ── */}
      {showRates && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(3,2,1,0.8)',
            backdropFilter: 'blur(6px)',
            animation: 'dimFadeIn 0.25s ease-out both',
          }}
          onClick={() => setShowRates(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#120e09',
              border: '1px solid rgba(200,144,10,0.15)',
              borderRadius: '8px',
              padding: '1.75rem 2rem',
              maxWidth: '380px',
              width: '90%',
              animation: 'modalPopIn 0.3s ease-out both',
              position: 'relative',
            }}
          >
            {/* 상단 골드 라인 */}
            <div style={{ position: 'absolute', top: 0, left: '1rem', right: '1rem', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(200,144,10,0.3), transparent)' }} />

            <h3 style={{
              fontSize: '0.9rem', fontFamily: 'var(--font-heading, sans-serif)',
              fontWeight: 700, color: '#c8a060', marginBottom: '1.25rem',
              textAlign: 'center', letterSpacing: '0.08em',
            }}>
              추출 확률 정보
            </h3>

            {/* 기본 확률 테이블 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(200,144,10,0.12)' }}>
                  <th style={{ padding: '0.4rem 0', fontSize: '0.6rem', color: '#6a5a40', fontWeight: 600, textAlign: 'left', fontFamily: 'var(--font-body, sans-serif)' }}>등급</th>
                  <th style={{ padding: '0.4rem 0', fontSize: '0.6rem', color: '#6a5a40', fontWeight: 600, textAlign: 'right', fontFamily: 'var(--font-body, sans-serif)' }}>확률</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { key: 'ego' as const, label: 'E.G.O', color: '#ff4444', rate: '1.3%' },
                  { key: '000' as const, label: '3성', color: '#ffd040', rate: '2.9%' },
                  { key: '00' as const, label: '2성', color: '#c0c0c0', rate: '12.8%' },
                  { key: '0' as const, label: '1성', color: '#8a7050', rate: '83.0%' },
                ]).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(200,144,10,0.06)' }}>
                    <td style={{ padding: '0.5rem 0', fontSize: '0.75rem', color: row.color, fontFamily: 'var(--font-heading, sans-serif)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {RESULT_RARITY_IMG[row.key] ? (
                        <Image src={RESULT_RARITY_IMG[row.key]!} alt={row.label} width={48} height={16} style={{ height: '16px', width: 'auto' }} />
                      ) : (
                        <span>{row.label}</span>
                      )}
                    </td>
                    <td style={{ padding: '0.5rem 0', fontSize: '0.75rem', color: '#b0a080', textAlign: 'right', fontFamily: 'var(--font-body, sans-serif)' }}>
                      {row.rate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 10번째 확정 */}
            <div style={{
              padding: '0.65rem 0.85rem',
              background: 'rgba(200,144,10,0.05)',
              border: '1px solid rgba(200,144,10,0.1)',
              borderRadius: '5px',
              marginBottom: '1rem',
            }}>
              <p style={{ fontSize: '0.65rem', color: '#a08a60', fontFamily: 'var(--font-body, sans-serif)', lineHeight: 1.6 }}>
                <span style={{ color: '#c8a060', fontWeight: 600 }}>10회차 확정</span>
                <br />
                10번째 추출은 1성 등급이 제외됩니다.
                <br />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  E.G.O 1.3% ·{' '}
                  <Image src={RESULT_RARITY_IMG['000']!} alt="3성" width={36} height={12} style={{ height: '12px', width: 'auto', display: 'inline-block', verticalAlign: 'middle' }} />
                  {' '}2.9% ·{' '}
                  <Image src={RESULT_RARITY_IMG['00']!} alt="2성" width={36} height={12} style={{ height: '12px', width: 'auto', display: 'inline-block', verticalAlign: 'middle' }} />
                  {' '}95.8%
                </span>
              </p>
            </div>

            {/* 닫기 */}
            <button
              onClick={() => setShowRates(false)}
              style={{
                display: 'block', width: '100%',
                padding: '0.5rem',
                background: 'rgba(200,144,10,0.08)',
                border: '1px solid rgba(200,144,10,0.15)',
                borderRadius: '4px',
                color: '#a09070',
                fontSize: '0.7rem',
                fontFamily: 'var(--font-body, sans-serif)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(200,144,10,0.15)'
                ;(e.currentTarget as HTMLElement).style.color = '#c8a060'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(200,144,10,0.08)'
                ;(e.currentTarget as HTMLElement).style.color = '#a09070'
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes dimFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes resultFadeIn {
          from { opacity: 0; transform: translate(-50%, -46%) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes modalPopIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes resultSlotReveal {
          from { opacity: 0; transform: translateY(10px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .extraction-btn:not(:disabled):hover {
          filter: brightness(1.12);
          transform: translateY(-1px);
        }
        .extraction-btn:not(:disabled):active {
          transform: translateY(0);
          filter: brightness(0.95);
        }
      `}</style>
    </div>
  )
}
