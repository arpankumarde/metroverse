import { useMemo, type RefObject } from 'react'
import { InstancedPanels, InstancedParts } from '../components/InstancedParts'
import type { MetroLine, RollingStockConfig } from '../data/types'
import { RollingWheels } from './RollingWheels'
import { Saloon } from './Saloon'
import { SlidingDoors } from './SlidingDoors'
import {
  BOGIE_HEIGHT,
  BOGIE_LENGTH,
  BOGIE_WIDTH,
  UNDERFRAME_BOTTOM_Y,
  UNDERFRAME_INSET,
  WHEEL_THICKNESS,
  doorGlassHeight,
  doorGlassWidth,
  doorHeadHeight,
  doorLeafTravel,
  doorLeafWidth,
  doorPanelHeight,
  fairingSize,
  roofPanelSize,
  trainLayout,
} from './geometry'
import { bodyShell, noseGlass, noseLamps, noseShell } from './shellGeometry'

/** Brushed stainless body, as on the DMRC standard-gauge fleet. */
const BODY_COLOR = '#d7dbde'
const ROOF_COLOR = '#b4b9be'
const DOOR_COLOR = '#c6cbd0'
const UNDERGEAR_COLOR = '#303338'
const WHEEL_COLOR = '#4a4d52'

/** Marker lights: white at the leading end, red at the trailing end. */
const HEADLIGHT_COLOR = '#fff3d0'
const HEADLIGHT_EMISSIVE = '#ffe9ad'
const TAILLIGHT_COLOR = '#5a1418'
const TAILLIGHT_EMISSIVE = '#ff2418'

/**
 * Glazing. Really transparent, not a dark panel standing in for it: the player
 * rides inside this train and has to be able to watch the line go past
 * (PLAN.md §1).
 *
 * Tinted dark rather than pale, and lightly. Looking across a car you see
 * through four panes at once — the near window, both door leaves, the far
 * window — and a pale tint laid over the view four times reads as fog inside
 * the train rather than as glass; a dark one darkens instead, which is also
 * what DMRC glazing actually does. It is deliberately dielectric — there is no
 * environment map in the scene, so anything metallic has nothing to reflect
 * and renders black — and it casts no shadow, so the sun falls through it on
 * to the saloon floor.
 */
const GLASS_COLOR = '#4a5560'
const GLASS_OPACITY = 0.18

interface TrainProps {
  stock: RollingStockConfig
  /** Supplies the livery band colour, so line identity propagates (PLAN.md §10). */
  line: MetroLine
  /** Side of the train the platform is on: only those doors open. */
  doorSide: 1 | -1
  /** How far the doors are open, 0 to 1, read every frame off the train's runtime. */
  doorOpen: RefObject<number>
  /** How far the train has run, in metres, so the wheels turn with it. */
  travelled: RefObject<number>
  /**
   * Whether to build the saloon inside. Off for trains too far away to see
   * into, which is most of them on a line this long (PLAN.md §28).
   */
  saloon?: boolean
}

/**
 * A train, drawn about its own centre.
 *
 * The car sides are built as a pierced wall rather than a solid box with panes
 * laid over it: the skin is the pieces left between the windows and doorways,
 * so the openings are real holes and the saloon behind them is really there.
 * The skin runs up to the saloon ceiling; only the shoulder above that is
 * solid, and it is the one piece that keeps the rounded roof profile.
 *
 * Every part that repeats — skin panels, roof caps, colour bands, door leaves,
 * glazing, bogies, wheels — is one InstancedMesh across the whole eight-car
 * set, which keeps a full train at roughly a dozen draw calls (PLAN.md §28).
 *
 * The train is drawn nose-first along its own +X, so the caller turns the
 * whole group around to work the other road; that keeps the leading cab, the
 * marker lights and the door travel all agreeing without any of them being
 * told which way the train is pointing.
 */
export function Train({ stock, line, doorSide, doorOpen, travelled, saloon = true }: TrainProps) {
  const layout = useMemo(() => trainLayout(stock), [stock])

  const wheelRadius = stock.wheelDiameter / 2
  const underframeHeight = stock.floorHeight - UNDERFRAME_BOTTOM_Y

  return (
    <group name={`train-${stock.id}`}>
      {saloon && <Saloon stock={stock} line={line} />}

      <InstancedPanels panels={layout.skin}>
        <boxGeometry />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.38} metalness={0.45} />
      </InstancedPanels>

      {/* The one part of the body left whole: the shoulder above the saloon
          ceiling, which is what carries the roof curve. It is one lofted
          section shared by every car of the class, so an eight-car set costs
          one upload and one draw call. */}
      <InstancedParts positions={layout.carBodies}>
        <primitive object={bodyShell(stock)} attach="geometry" />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.38} metalness={0.45} />
      </InstancedParts>

      <InstancedParts positions={layout.roofPanels}>
        <boxGeometry args={[...roofPanelSize(stock)]} />
        <meshStandardMaterial color={ROOF_COLOR} roughness={0.75} metalness={0.2} />
      </InstancedParts>

      {/* The lower fairing, and the bellows across each car gap: between them
          they are what makes an eight-car set read as one continuous body
          rather than eight boxes floating over a dark undergear tray. */}
      <InstancedPanels panels={layout.skirts}>
        <boxGeometry />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.45} metalness={0.35} />
      </InstancedPanels>

      <InstancedParts positions={layout.fairings}>
        <boxGeometry args={[...fairingSize(stock)]} />
        <meshStandardMaterial color={UNDERGEAR_COLOR} roughness={0.9} />
      </InstancedParts>

      {/* One unbroken run of light down the whole train in the line's own
          colour, car gaps included: at any distance it is the first thing
          that says which line this train is (PLAN.md §10). */}
      <InstancedPanels panels={layout.ledStrips} castShadow={false}>
        <boxGeometry />
        <meshStandardMaterial
          color={line.color}
          emissive={line.color}
          emissiveIntensity={0.85}
          roughness={0.4}
        />
      </InstancedPanels>

      <InstancedPanels panels={layout.bands}>
        <boxGeometry />
        <meshStandardMaterial color={line.color} roughness={0.5} />
      </InstancedPanels>

      <InstancedParts positions={layout.windows} castShadow={false}>
        <boxGeometry args={[stock.windowWidth, stock.windowHeight, 0.02]} />
        <meshStandardMaterial
          color={GLASS_COLOR}
          roughness={0.1}
          metalness={0}
          transparent
          opacity={GLASS_OPACITY}
          depthWrite={false}
        />
      </InstancedParts>

      <SlidingDoors
        leaves={layout.doorLeaves}
        travel={doorLeafTravel(stock)}
        openSide={doorSide}
        open={doorOpen}
      >
        <boxGeometry args={[doorLeafWidth(stock), doorPanelHeight(stock), 0.04]} />
        <meshStandardMaterial color={DOOR_COLOR} roughness={0.45} metalness={0.35} />
      </SlidingDoors>

      <SlidingDoors
        leaves={layout.doorHeads}
        travel={doorLeafTravel(stock)}
        openSide={doorSide}
        open={doorOpen}
      >
        <boxGeometry args={[doorLeafWidth(stock), doorHeadHeight(), 0.04]} />
        <meshStandardMaterial color={DOOR_COLOR} roughness={0.45} metalness={0.35} />
      </SlidingDoors>

      <SlidingDoors
        leaves={layout.doorBands}
        travel={doorLeafTravel(stock)}
        openSide={doorSide}
        open={doorOpen}
      >
        <boxGeometry args={[doorLeafWidth(stock), stock.bandHeight, 0.02]} />
        <meshStandardMaterial color={line.color} roughness={0.5} />
      </SlidingDoors>

      <SlidingDoors
        leaves={layout.doorGlass}
        travel={doorLeafTravel(stock)}
        openSide={doorSide}
        open={doorOpen}
        castShadow={false}
      >
        <boxGeometry args={[doorGlassWidth(stock), doorGlassHeight(stock), 0.02]} />
        <meshStandardMaterial
          color={GLASS_COLOR}
          roughness={0.1}
          metalness={0}
          transparent
          opacity={GLASS_OPACITY}
          depthWrite={false}
        />
      </SlidingDoors>

      <InstancedParts positions={layout.underframes}>
        <boxGeometry args={[stock.carLength - 0.4, underframeHeight, stock.carWidth - UNDERFRAME_INSET]} />
        <meshStandardMaterial color={UNDERGEAR_COLOR} roughness={0.9} />
      </InstancedParts>

      <InstancedParts positions={layout.bogies}>
        <boxGeometry args={[BOGIE_LENGTH, BOGIE_HEIGHT, BOGIE_WIDTH]} />
        <meshStandardMaterial color={UNDERGEAR_COLOR} roughness={0.85} />
      </InstancedParts>

      <RollingWheels positions={layout.wheels} radius={wheelRadius} travelled={travelled}>
        <cylinderGeometry args={[wheelRadius, wheelRadius, WHEEL_THICKNESS, 18]} />
        <meshStandardMaterial color={WHEEL_COLOR} roughness={0.5} metalness={0.7} />
      </RollingWheels>

      {/* Each driving end. The nose fairing carries its windscreen and its
          lamp strips as patches of its own surface lifted a few millimetres
          clear of it, so there is no flat pane set into a curved body to
          catch the eye as a join. All three are drawn from the nose root
          along its own +X, so the far end is the same geometry turned end
          for end rather than a mirrored copy. */}
      {layout.cabEnds.map(({ x, facing }) => {
        // The train always works nose-first along its own +X, so the cab at
        // that end is the one showing white and the other shows red.
        const leading = facing === 1

        return (
          <group key={facing} position={[x, 0, 0]} rotation={[0, leading ? 0 : Math.PI, 0]}>
            <mesh geometry={noseShell(stock)} castShadow receiveShadow>
              <meshStandardMaterial color={BODY_COLOR} roughness={0.38} metalness={0.45} />
            </mesh>

            <mesh geometry={noseGlass(stock)} castShadow={false}>
              <meshStandardMaterial
                color={GLASS_COLOR}
                roughness={0.1}
                metalness={0}
                transparent
                opacity={GLASS_OPACITY}
                depthWrite={false}
              />
            </mesh>

            <mesh geometry={noseLamps(stock)} castShadow={false}>
              <meshStandardMaterial
                color={leading ? HEADLIGHT_COLOR : TAILLIGHT_COLOR}
                emissive={leading ? HEADLIGHT_EMISSIVE : TAILLIGHT_EMISSIVE}
                emissiveIntensity={leading ? 0.9 : 0.75}
                roughness={0.3}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
