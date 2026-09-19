import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping } from 'three'
import { FirstPersonPlayer } from './components/FirstPersonPlayer'
import { LineScene } from './scenes/LineScene'
import { SPAWN, WALK_VOLUME } from './scenes/blueLine'
import { AnnouncementCaption } from './ui/AnnouncementCaption'

export default function App() {
  return (
    <>
      <Canvas
        shadows
        camera={{ fov: 70, near: 0.1, far: 1200 }}
        gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
      >
        <LineScene />
        <FirstPersonPlayer volume={WALK_VOLUME} spawn={SPAWN} />
      </Canvas>

      <AnnouncementCaption />

      <p className="look-hint">
        Drag to look
        <span className="sep">·</span>
        <kbd>W</kbd>
        <kbd>A</kbd>
        <kbd>S</kbd>
        <kbd>D</kbd> to walk
        <span className="sep">·</span>
        <kbd>Shift</kbd> to run
      </p>
    </>
  )
}
