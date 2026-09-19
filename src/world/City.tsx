import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'
import { NearCamera } from '../components/NearCamera'
import { InstancedParts, InstancedPanels } from '../components/InstancedParts'
import { corridorEnd, corridorStart } from '../data/corridor'
import { BLUE_LANDMARKS } from '../data/city'
import type { CorridorConfig } from '../data/types'
import { GROUND_Y } from './Daylight'
import { Landmark } from './Landmark'
import { Traffic } from './Traffic'
import { BLOCK_LENGTH, buildBlock, type BlockContents } from './cityBlock'

/**
 * Delhi, either side of the line (PLAN.md §19).
 *
 * The plan is explicit that this must not be an attempt at modelling the
 * city, and it is not: it is the two hundred metres of corridor the player
 * can actually see from a train window, built as a strip of blocks that are
 * generated when the player gets near and thrown away when they leave.
 *
 * What holds it together is that it is all boxes. A whole block — its road,
 * its kerbs, its footpaths, thirty buildings, their parapets, their water
 * tanks and their hoardings — is one instanced draw call, and the windows
 * are a second. That is the only reason six kilometres of city fits inside
 * the budget at all (PLAN.md §28).
 */

/** Foliage and bark, drawn as two more instanced meshes per block. */
const TRUNK_SEGMENTS = 6

/**
 * How far below street level the player has to be before the city above
 * stops being drawn.
 *
 * Inside the bore there is nothing to see but the bore, so none of it is
 * worth a draw call. The threshold is well below the portal, so the city is
 * still there to run out into.
 */
const BURIED_BELOW = GROUND_Y - 1.5

interface AbovegroundProps {
  children: ReactNode
}

/** Contents that are only drawn while the player is not inside a tunnel. */
function Aboveground({ children }: AbovegroundProps) {
  const group = useRef<Group>(null)

  useFrame(({ camera }) => {
    const scene = group.current
    if (scene) scene.visible = camera.position.y > BURIED_BELOW
  })

  return <group ref={group}>{children}</group>
}

interface CityBlockProps {
  contents: BlockContents
}

/** One block of frontage, drawn in five draw calls however much is in it. */
function CityBlock({ contents }: CityBlockProps) {
  return (
    <>
      <InstancedPanels panels={contents.solid} castShadow={false} receiveShadow={false}>
        <boxGeometry />
        <meshStandardMaterial color="#ffffff" roughness={0.93} />
      </InstancedPanels>

      <InstancedPanels panels={contents.glazing} castShadow={false} receiveShadow={false}>
        <boxGeometry />
        <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.4} />
      </InstancedPanels>

      <InstancedPanels panels={contents.lamps} castShadow={false} receiveShadow={false}>
        <boxGeometry />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffdca8"
          emissiveIntensity={0.7}
          roughness={0.5}
        />
      </InstancedPanels>

      <InstancedParts
        positions={contents.trunks.map((tree) => tree.position)}
        sizes={contents.trunks.map((tree) => tree.size)}
        colors={contents.trunks.map((tree) => tree.color)}
        castShadow={false}
        receiveShadow={false}
      >
        <cylinderGeometry args={[0.15, 0.24, 1, TRUNK_SEGMENTS]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} />
      </InstancedParts>

      <InstancedParts
        positions={contents.canopies.map((tree) => tree.position)}
        sizes={contents.canopies.map((tree) => tree.size)}
        colors={contents.canopies.map((tree) => tree.color)}
        castShadow={false}
        receiveShadow={false}
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} flatShading />
      </InstancedParts>
    </>
  )
}

interface CityProps {
  corridor: CorridorConfig
}

export function City({ corridor }: CityProps) {
  const blocks = useMemo(() => {
    const start = corridorStart(corridor)
    const end = corridorEnd(corridor)
    const count = Math.max(1, Math.round((end - start) / BLOCK_LENGTH))
    const pitch = (end - start) / count

    return Array.from({ length: count }, (_, index) => {
      const from = start + index * pitch
      const to = index === count - 1 ? end : from + pitch
      return { index, from, to, contents: buildBlock(index, from, to) }
    })
  }, [corridor])

  return (
    <Aboveground>
      <group name={`${corridor.id}-city`}>
        {blocks.map((block) => (
          <NearCamera
            key={block.index}
            x={(block.from + block.to) / 2}
            reach={(block.to - block.from) / 2 + 60}
          >
            <CityBlock contents={block.contents} />
          </NearCamera>
        ))}

        {BLUE_LANDMARKS.map((landmark) => (
          <NearCamera
            key={landmark.id}
            x={landmark.x}
            reach={Math.max(landmark.width, landmark.depth)}
          >
            <Landmark landmark={landmark} />
          </NearCamera>
        ))}

        <Traffic />
      </group>
    </Aboveground>
  )
}
