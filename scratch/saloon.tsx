// TEMPORARY visual harness for the coach interior. Not part of the app.
import { StrictMode, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping, Euler } from 'three'
import { BLUE_LINE } from '../src/data/lines'
import { DMRC_STANDARD_GAUGE } from '../src/data/rollingStock'
import { Train } from '../src/train/Train'

const q = new URLSearchParams(location.search)
const num = (k: string, d: number) => Number(q.get(k) ?? d)
const VIEW = { x: num('x', 10.67), y: num('y', 2.75), z: num('z', 0.3), yaw: num('yaw', Math.PI / 2), pitch: num('pitch', 0) }
const DOORS = num('doors', 1)

const orientation = new Euler(0, 0, 0, 'YXZ')

function Eye() {
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    camera.position.set(VIEW.x, VIEW.y, VIEW.z)
    orientation.set(VIEW.pitch, VIEW.yaw, 0)
    camera.quaternion.setFromEuler(orientation)
  })
  return null
}

function Scene() {
  const doorOpen = useRef(DOORS)
  const travelled = useRef(0)
  return (
    <>
      <color attach="background" args={['#c3ccd6']} />
      <fog attach="fog" args={['#c3ccd6', 80, 340]} />
      <hemisphereLight args={['#dbe8f5', '#b0a894', 1.5]} />
      <ambientLight intensity={0.55} color="#c9d2dc" />
      <directionalLight position={[62, 58, 96]} intensity={1.9} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-100} shadow-camera-right={100} shadow-camera-top={50} shadow-camera-bottom={-50}
        shadow-camera-near={1} shadow-camera-far={320} shadow-bias={-0.0008} shadow-normalBias={0.04} />
      <mesh position={[0, 1.1, 5.55]} receiveShadow>
        <boxGeometry args={[200, 0.02, 8]} />
        <meshStandardMaterial color="#9c9a92" roughness={1} />
      </mesh>
      <mesh position={[0, -0.8, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#8e8878" roughness={1} />
      </mesh>
      <Train stock={DMRC_STANDARD_GAUGE} line={BLUE_LINE} doorSide={1} doorOpen={doorOpen} travelled={travelled} saloon />
      <Eye />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Canvas shadows camera={{ fov: 70, near: 0.1, far: 1200 }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 0.9 }}>
      <Scene />
    </Canvas>
  </StrictMode>,
)
