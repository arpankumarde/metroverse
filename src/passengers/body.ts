import type { Object3D } from 'three'
import type { Vec3 } from '../components/InstancedParts'

/**
 * What a passenger is made of, and what they are doing with it (PLAN.md §18).
 *
 * A crowd has to be cheap enough that there can be a crowd, so a person is
 * nine boxes and no skeleton: a head with hair on it, a torso, two arms, two
 * thighs and two shins. Each of the nine is one instance in one InstancedMesh
 * shared by everybody in sight, which is what puts three hundred people on a
 * platform for nine draw calls (PLAN.md §28).
 *
 * What sells them at the distance you actually see them is not the modelling
 * but the placing: the walk cycle swings the legs from the hip and counters
 * with the arms, and sitting folds the same nine boxes the way a person folds
 * on a bench. Per-instance colour does the rest — no two people in the same
 * shirt next to each other.
 *
 * Nothing here knows about the simulation. It poses a body in the body's own
 * space, feet at the origin and facing +Z, and the renderer puts that space
 * wherever the person is.
 */

export const Part = {
  HEAD: 0,
  HAIR: 1,
  TORSO: 2,
  ARM_L: 3,
  ARM_R: 4,
  THIGH_L: 5,
  THIGH_R: 6,
  SHIN_L: 7,
  SHIN_R: 8,
} as const

export type Part = (typeof Part)[keyof typeof Part]

export const PART_COUNT = 9

/** Box dimensions of each part, in the order of `Part`. */
export const PART_SIZE: readonly Vec3[] = [
  [0.17, 0.22, 0.19],
  [0.185, 0.085, 0.205],
  [0.37, 0.58, 0.23],
  [0.105, 0.56, 0.115],
  [0.105, 0.56, 0.115],
  [0.145, 0.42, 0.155],
  [0.145, 0.42, 0.155],
  [0.125, 0.44, 0.135],
  [0.125, 0.44, 0.135],
]

/** The skeleton the boxes hang on, for a person of the nominal 1.71 m. */
const SHIN = 0.44
const THIGH = 0.42
const HIP_Y = SHIN + THIGH
const TORSO = 0.58
const NECK = 0.05
const HEAD = 0.22
const ARM = 0.56
const HIP_X = 0.095
const SHOULDER_X = 0.2

/** How far the limbs swing at a full walking pace, in radians. */
const LEG_SWING = 0.62
const ARM_SWING = 0.42
const KNEE_BEND = 0.75

/** How far the body rises and falls over one stride, in metres. */
const GAIT_BOB = 0.022

/** Standing still is not standing rigid: the chest moves. */
const BREATH = 0.006

/** How far a seated passenger reclines against the back of the bench. */
const RECLINE = 0.06

/** How far a seated passenger's hands fall towards their lap. */
const SEATED_ARM = 0.3

export interface BodyPose {
  /** How far through the walk cycle, in radians. */
  stride: number
  /** Nought standing still, one walking flat out. */
  pace: number
  seated: boolean
  /**
   * Height of the seat pan above the floor, in the body's own space — so
   * already divided by whatever the body is scaled by.
   */
  seatY: number
  /** Free-running time, for the parts of a body that never quite stop. */
  time: number
}

/**
 * Place a limb hanging from a joint, swung forwards by `angle`.
 *
 * The box hangs down its own -Y, so swinging it forwards is a rotation about
 * -X, and the centre goes half a limb along wherever that points.
 */
function limb(
  part: Object3D,
  x: number,
  y: number,
  z: number,
  length: number,
  angle: number,
): void {
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)

  part.position.set(x, y - cos * (length / 2), z + sin * (length / 2))
  part.rotation.set(-angle, 0, 0)
}

/** Stack the head and its hair on top of a torso whose top is at `y`. */
function head(parts: Object3D[], y: number, z: number): void {
  const headPart = parts[Part.HEAD]
  const hairPart = parts[Part.HAIR]
  if (!headPart || !hairPart) return

  const centre = y + NECK + HEAD / 2
  headPart.position.set(0, centre, z)
  headPart.rotation.set(0, 0, 0)

  // A cap of hair over the crown, set back a little off the brow.
  hairPart.position.set(0, centre + HEAD / 2 - 0.02, z - 0.012)
  hairPart.rotation.set(0, 0, 0)
}

/**
 * Pose a body, feet at the origin and facing +Z.
 *
 * `parts` is nine scratch objects the caller owns and reuses, so posing a
 * crowd allocates nothing.
 */
export function poseBody(parts: Object3D[], pose: BodyPose): void {
  if (pose.seated) {
    poseSeated(parts, pose)
    return
  }

  const swing = Math.sin(pose.stride) * LEG_SWING * pose.pace
  const armSwing = Math.sin(pose.stride) * ARM_SWING * pose.pace

  // The trailing leg is the one that bends: the knee comes up behind as the
  // foot leaves the ground, which is the half of the cycle that reads.
  const bendL = Math.max(0, -Math.sin(pose.stride + 0.9)) * KNEE_BEND * pose.pace
  const bendR = Math.max(0, Math.sin(pose.stride + 0.9)) * KNEE_BEND * pose.pace

  // Rise and fall twice per stride, and breathe when there is no stride.
  const bob =
    -GAIT_BOB * pose.pace * (0.5 - 0.5 * Math.cos(2 * pose.stride)) +
    BREATH * (1 - pose.pace) * Math.sin(pose.time * 1.7)

  const hipY = HIP_Y + bob

  leg(parts, Part.THIGH_L, Part.SHIN_L, HIP_X, hipY, swing, bendL)
  leg(parts, Part.THIGH_R, Part.SHIN_R, -HIP_X, hipY, -swing, bendR)

  const shoulderY = hipY + TORSO
  const torso = parts[Part.TORSO]
  if (torso) {
    torso.position.set(0, hipY + TORSO / 2, 0)
    torso.rotation.set(0, 0, 0)
  }

  // Arms counter the legs, so the body stays wound against its own stride.
  const armL = parts[Part.ARM_L]
  const armR = parts[Part.ARM_R]
  if (armL) limb(armL, SHOULDER_X, shoulderY, 0, ARM, -armSwing)
  if (armR) limb(armR, -SHOULDER_X, shoulderY, 0, ARM, armSwing)

  head(parts, shoulderY, 0)
}

/** One leg: a thigh swung from the hip and a shin bent back off the knee. */
function leg(
  parts: Object3D[],
  thighPart: number,
  shinPart: number,
  x: number,
  hipY: number,
  swing: number,
  bend: number,
): void {
  const thigh = parts[thighPart]
  const shin = parts[shinPart]
  if (!thigh || !shin) return

  limb(thigh, x, hipY, 0, THIGH, swing)

  // The shin hangs from the knee, which is wherever the thigh's far end got to.
  limb(
    shin,
    x,
    hipY - Math.cos(swing) * THIGH,
    Math.sin(swing) * THIGH,
    SHIN,
    swing - bend,
  )
}

/** The same nine boxes, folded onto a bench with the hips at the seat pan. */
function poseSeated(parts: Object3D[], pose: BodyPose): void {
  const hipY = pose.seatY + 0.04
  const breath = BREATH * Math.sin(pose.time * 1.5)

  // Thighs forward off the pan, shins straight down from the knee to the floor.
  seatedLeg(parts, Part.THIGH_L, Part.SHIN_L, HIP_X, hipY)
  seatedLeg(parts, Part.THIGH_R, Part.SHIN_R, -HIP_X, hipY)

  // Sitting back against the moulded back, which is behind the hips.
  const lean = Math.sin(RECLINE)
  const rise = Math.cos(RECLINE)
  const shoulderY = hipY + rise * TORSO + breath

  const torso = parts[Part.TORSO]
  if (torso) {
    torso.position.set(0, hipY + (rise * TORSO) / 2 + breath, -lean * (TORSO / 2) - 0.04)
    torso.rotation.set(RECLINE, 0, 0)
  }

  const armL = parts[Part.ARM_L]
  const armR = parts[Part.ARM_R]
  const armZ = -lean * TORSO - 0.04
  if (armL) limb(armL, SHOULDER_X, shoulderY, armZ, ARM, SEATED_ARM)
  if (armR) limb(armR, -SHOULDER_X, shoulderY, armZ, ARM, SEATED_ARM)

  head(parts, shoulderY, -lean * TORSO - 0.01)
}

/** One seated leg: thigh out along the pan, shin down to the floor. */
function seatedLeg(
  parts: Object3D[],
  thighPart: number,
  shinPart: number,
  x: number,
  hipY: number,
): void {
  const thigh = parts[thighPart]
  const shin = parts[shinPart]
  if (!thigh || !shin) return

  limb(thigh, x, hipY, 0, THIGH, Math.PI / 2)
  limb(shin, x, hipY, THIGH, SHIN, 0)
}

/* ---------------------------------------------------------------- palettes */

/**
 * What the crowd is wearing.
 *
 * Deliberately wide. A platform of people in three shades of grey reads as
 * clones however well they are animated, and a Delhi platform is not grey —
 * it is white office shirts and school uniforms next to reds and yellows and
 * saffron. The variety is free: per-instance colour costs three floats.
 */
const SKIN: readonly number[] = [
  0x8d5a3b, 0xa9713f, 0xc68642, 0x6f4626, 0xdda06a, 0x7b4a2b, 0xb2793f, 0x94603a,
]

const HAIR: readonly number[] = [0x14100e, 0x1d1713, 0x2a201a, 0x3a2f27, 0x5c534d, 0x8b8279]

const SHIRT: readonly number[] = [
  0xf2f0ea, 0xe8e4da, 0xd8dde3, 0x3f5d8f, 0x2b4a6f, 0x8c2f39, 0xd9a441, 0x4a7c59,
  0xb0483c, 0xefe3c8, 0x5c4a7d, 0x2f6f7a, 0xc96f2e, 0x37474f, 0xa8324a, 0xe07a3c,
  0x6d8f3f, 0x24384a, 0xf0d8c0, 0x7a2f6b,
]

const TROUSERS: readonly number[] = [
  0x2b2f38, 0x1f2430, 0x3d3a35, 0x4a4f57, 0x5b4636, 0x23303f, 0x6b6257, 0x2e2e2e,
  0x8a7f6d, 0x394a3a, 0x6f2f34, 0x2f3f5f,
]

/** How the nine parts are coloured: skin, hair, shirt or trousers. */
export interface BodyColors {
  skin: number
  hair: number
  shirt: number
  trousers: number
  /** Long sleeves put the shirt colour on the arms instead of skin. */
  sleeves: boolean
}

function pick(palette: readonly number[], random: () => number): number {
  return palette[Math.floor(random() * palette.length)] ?? palette[0] ?? 0xffffff
}

export function bodyColors(random: () => number): BodyColors {
  return {
    skin: pick(SKIN, random),
    hair: pick(HAIR, random),
    shirt: pick(SHIRT, random),
    trousers: pick(TROUSERS, random),
    sleeves: random() < 0.45,
  }
}

/** The colour of one part of one person. */
export function partColor(colors: BodyColors, part: number): number {
  switch (part) {
    case Part.HEAD:
      return colors.skin
    case Part.HAIR:
      return colors.hair
    case Part.TORSO:
      return colors.shirt
    case Part.ARM_L:
    case Part.ARM_R:
      return colors.sleeves ? colors.shirt : colors.skin
    default:
      return colors.trousers
  }
}
