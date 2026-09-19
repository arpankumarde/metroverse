import { corridorStation } from '../data/corridor'
import type { CorridorConfig, RollingStockConfig } from '../data/types'
import { platformForTrack, trackById } from '../stations/geometry'
import { THRESHOLD_OPEN, type Carriage } from '../train/carriage'
import type { Road } from '../train/roads'
import { TrainState, isBerthed, type TrainRuntime } from '../train/service'
import { bodyColors, type BodyColors } from './body'
import {
  nearestDoor,
  platformStances,
  saloonSpots,
  type PlatformStances,
  type SaloonSpots,
  type Spot,
} from './spots'

/**
 * The crowd: people who ride the line for their own reasons (PLAN.md §18).
 *
 * Nobody here is placed, scripted or triggered by the player. A passenger
 * comes up the escalator because the platform is thinner than it should be,
 * waits at whichever doorway they happened to stop at, gets on the next train
 * because it is the next train, rides to a station they picked when they
 * boarded, and walks back down the stairs. The player can stand in the middle
 * of all of it and change none of it.
 *
 * What ties them to everything else is that they read the same train state
 * machine the doors, the boards and the announcements read: a stop is worked
 * when the doors of that particular train pass half open, and never because
 * anything told the crowd a train was due (PLAN.md §7, §16).
 *
 * This is plain simulation — no three.js, no React. `Crowd.tsx` draws it.
 */

export const PassengerState = {
  /** Stood or sat on a platform, waiting for a train. */
  WAITING: 'WAITING',
  /** Walking from the platform into a coach. */
  BOARDING: 'BOARDING',
  /** Aboard, in a seat or holding on. */
  RIDING: 'RIDING',
  /** Walking from a coach out on to a platform. */
  EXITING: 'EXITING',
  /** On their feet on a platform, going somewhere. */
  WALKING: 'WALKING',
} as const

export type PassengerState = (typeof PassengerState)[keyof typeof PassengerState]

/** How many people the line can have at once. */
const MAX_PEOPLE = 1300

/**
 * How many will ride in one train, and how many wait on a platform once it
 * has settled.
 *
 * Both are well short of a Delhi crush, and deliberately: the crowd is a
 * sample of the real one, sized so that a busy platform reads as busy from
 * where the player is standing without the far end of the line costing
 * anything to keep running (PLAN.md §28).
 */
const TRAIN_CAPACITY = 60
const PLATFORM_TARGET = 22

/** Seconds between people coming up from the concourse, on average. */
const ARRIVAL_GAP = 2.8

/** How far below the deck the head of a flight is, for coming up and going down. */
const EMERGE_DROP = 1.5
const LIFT_RATE = 2.4

/** Doors at least this far open are a doorway people will use. */
const WORKING_DOORS = 0.6

/** Seconds between successive people through the same doorway. */
const DOOR_STAGGER = 0.55

/** How long the people boarding hold back for the people getting off. */
const BOARD_DELAY = 1.6

/** Walking pace, in m/s. Nobody on a platform is in quite the same hurry. */
const SLOWEST = 1.05
const FASTEST = 1.6

/** Radians of a stride per metre walked, matching the player's gait. */
const STRIDE_PER_METRE = 5.97

/** How fast a body turns to face where it is going, in rad/s. */
const TURN_RATE = 5.5

/** Exponential rate at which the gait fades in and out. */
const PACE_RATE = 7

/** How far out the body leans per m/s² of the train under it (PLAN.md §22). */
const LEAN_PER_ACCELERATION = 0.055
const LEAN_LIMIT = 0.13
const LEAN_RATE = 4

export interface Passenger {
  active: boolean
  /**
   * Bumped every time this body is taken out of the pool again. The renderer
   * reuses instance slots, and without this a slot could hold the same pool
   * index twice running and keep the last person's clothes on the new one.
   */
  serial: number
  state: PassengerState
  /** The carriage their position is measured in, or null for the ground. */
  frame: Carriage | null
  x: number
  z: number
  /** The floor under them, measured from their frame where they have one. */
  floorY: number
  /** How far below that floor they still are, coming up or going down a flight. */
  lift: number
  liftTo: number
  yaw: number
  /** Where they are turning to face. */
  faceTo: number
  /** Where they are walking, as flat x,z pairs in their own frame. */
  path: number[]
  step: number
  /** Seconds to stand still before moving off. */
  hold: number
  /** How far through the walk cycle, and how much of a walk it is. */
  stride: number
  pace: number
  speed: number
  /** Their own clock, so a crowd does not breathe in unison. */
  phase: number
  /** How the body leans against the train working under it. */
  lean: number
  seated: boolean
  /** Height of the seat pan they are on, above the floor. */
  seatY: number
  /** Body size, as a multiple of the nominal 1.71 m. */
  scale: number
  colors: BodyColors

  /** The platform they are on, while they are on one. */
  platform: PlatformCrowd | null
  /** The stance they hold there, or -1. */
  stance: number
  /** The doorway they are queued at, or came out of. */
  berth: number
  /** Walking off the platform rather than on to it. */
  leaving: boolean

  /** The train they are aboard or getting into, or null. */
  train: TrainCrowd | null
  /** The place they hold in it, or -1. */
  spot: number
  /** The call they get off at. Past the last one means they stay aboard. */
  alightAt: number
}

/** One platform, as somewhere people gather. */
interface PlatformCrowd {
  stances: PlatformStances
  /** Which stances are spoken for. */
  taken: boolean[]
  /** How many people are waiting here or on their way to wait here. */
  expected: number
  /** Seconds until the next person comes up from the concourse. */
  nextArrival: number
}

/** One train, as somewhere people ride. */
interface TrainCrowd {
  runtime: TrainRuntime
  carriage: Carriage
  spots: SaloonSpots
  /** The platforms of this train's road, indexed by call. */
  stops: PlatformCrowd[]
  /** Which places aboard are spoken for. */
  taken: boolean[]
  riders: number
  /** The call already worked, so a stop is worked once and not every frame. */
  worked: number
  inService: boolean
}

export interface CrowdSim {
  /** A fixed pool: everyone who could exist, active or not. */
  people: Passenger[]
  platforms: PlatformCrowd[]
  trains: TrainCrowd[]
  random: () => number
  /** Where the next search for a free body in the pool starts. */
  cursor: number
  /** Scratch: how many people are already queued through each doorway. */
  queue: Int16Array
}

/**
 * Mulberry32. A crowd wants a lot of small decisions and none of them want to
 * be different every time the page is reloaded — a line that is populated the
 * same way twice is one that can be looked at twice.
 */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function createPassenger(): Passenger {
  return {
    active: false,
    serial: 0,
    state: PassengerState.WAITING,
    frame: null,
    x: 0,
    z: 0,
    floorY: 0,
    lift: 0,
    liftTo: 0,
    yaw: 0,
    faceTo: 0,
    path: [],
    step: 0,
    hold: 0,
    stride: 0,
    pace: 0,
    speed: 1.3,
    phase: 0,
    lean: 0,
    seated: false,
    seatY: 0,
    scale: 1,
    colors: { skin: 0, hair: 0, shirt: 0, trousers: 0, sleeves: false },
    platform: null,
    stance: -1,
    berth: 0,
    leaving: false,
    train: null,
    spot: -1,
    alightAt: 0,
  }
}

/**
 * Everyone who rides the line, ready to be stepped.
 *
 * The platforms are filled and the trains already out on the line are loaded
 * before this returns, for the same reason the service itself is warmed up:
 * the player arrives at a line that has been running all morning, not at one
 * where the first passenger is about to come up the escalator.
 */
export function createCrowd(
  corridor: CorridorConfig,
  roads: ReadonlyMap<string, Road>,
  stock: RollingStockConfig,
): CrowdSim {
  const crowd: CrowdSim = {
    people: Array.from({ length: MAX_PEOPLE }, createPassenger),
    platforms: [],
    trains: [],
    random: makeRandom(0x5eed1e),
    cursor: 0,
    queue: new Int16Array(0),
  }

  let doors = 0

  for (const road of roads.values()) {
    const { schedule } = road
    const spots = saloonSpots(stock, schedule.platformSide)
    const track = trackById(corridor.tracks, schedule.trackId)
    doors = Math.max(doors, spots.doors.length)

    const stops = schedule.calls.map((call) => {
      const { station, x } = corridorStation(corridor, call.stationId)
      const stances = platformStances(
        platformForTrack(station, schedule.trackId),
        track,
        x,
        spots.doors,
      )

      const platform: PlatformCrowd = {
        stances,
        taken: new Array<boolean>(stances.stances.length).fill(false),
        expected: 0,
        nextArrival: 0,
      }
      return platform
    })

    crowd.platforms.push(...stops)

    road.trains.forEach((runtime, slot) => {
      const carriage = road.carriages[slot]
      if (!carriage) return

      crowd.trains.push({
        runtime,
        carriage,
        spots,
        stops,
        taken: new Array<boolean>(spots.spots.length).fill(false),
        riders: 0,
        worked: -1,
        inService: false,
      })
    })
  }

  crowd.queue = new Int16Array(doors)

  for (const platform of crowd.platforms) fillPlatform(crowd, platform)
  for (const train of crowd.trains) syncTrain(crowd, train)

  return crowd
}

/** Advance the whole crowd by `delta` seconds. */
export function stepCrowd(crowd: CrowdSim, delta: number): void {
  for (const train of crowd.trains) syncTrain(crowd, train)
  for (const platform of crowd.platforms) replenish(crowd, platform, delta)

  for (const person of crowd.people) {
    if (person.active) stepPerson(crowd, person, delta)
  }
}

/* -------------------------------------------------------------- the pool */

/** A free body from the pool, made new, or null if the line is at capacity. */
function spawn(crowd: CrowdSim): Passenger | null {
  const people = crowd.people

  for (let tries = 0; tries < people.length; tries++) {
    const index = (crowd.cursor + tries) % people.length
    const person = people[index]
    if (!person || person.active) continue

    crowd.cursor = (index + 1) % people.length

    person.active = true
    person.serial++
    person.frame = null
    person.path.length = 0
    person.step = 0
    person.hold = 0
    person.stride = crowd.random() * Math.PI * 2
    person.pace = 0
    person.lift = 0
    person.liftTo = 0
    person.lean = 0
    person.seated = false
    person.seatY = 0
    person.speed = SLOWEST + crowd.random() * (FASTEST - SLOWEST)
    person.phase = crowd.random() * 100
    person.scale = 0.93 + crowd.random() * 0.14
    person.colors = bodyColors(crowd.random)
    person.platform = null
    person.stance = -1
    person.berth = 0
    person.leaving = false
    person.train = null
    person.spot = -1
    person.alightAt = 0

    return person
  }

  return null
}

/** Put a body back in the pool, letting go of everything it was holding. */
function release(crowd: CrowdSim, person: Passenger): void {
  if (person.platform && person.stance >= 0) freeStance(person.platform, person)
  if (person.train && person.spot >= 0) freeSpot(person.train, person)

  person.active = false
  person.frame = null
  person.platform = null
  person.train = null
  person.path.length = 0
  crowd.cursor = 0
}

/* ------------------------------------------------------------- platforms */

/** Take a place to wait, preferring a seat or preferring to stand. */
function takeStance(crowd: CrowdSim, platform: PlatformCrowd, wantSeat: boolean): number {
  const { stances } = platform.stances
  const count = stances.length
  if (count === 0) return -1

  const start = Math.floor(crowd.random() * count)
  let fallback = -1

  for (let i = 0; i < count; i++) {
    const index = (start + i) % count
    if (platform.taken[index]) continue

    const spot = stances[index]
    if (!spot) continue
    if (spot.seated === wantSeat) return index
    if (fallback < 0) fallback = index
  }

  return fallback
}

function freeStance(platform: PlatformCrowd, person: Passenger): void {
  platform.taken[person.stance] = false
  person.stance = -1
  platform.expected--
}

/** Stand somebody at a free place on a platform. Returns false if it is full. */
function standOnPlatform(crowd: CrowdSim, platform: PlatformCrowd, person: Passenger): Spot | null {
  const index = takeStance(crowd, platform, crowd.random() < 0.3)
  if (index < 0) return null

  const spot = platform.stances.stances[index]
  if (!spot) return null

  platform.taken[index] = true
  platform.expected++
  person.platform = platform
  person.stance = index
  person.berth = platform.stances.berth[index] ?? 0
  person.floorY = platform.stances.deckY

  return spot
}

/** Fill a platform to the crowd it would have if it had been open all morning. */
function fillPlatform(crowd: CrowdSim, platform: PlatformCrowd): void {
  const want = Math.round(PLATFORM_TARGET * (0.4 + crowd.random() * 0.6))

  for (let i = 0; i < want; i++) {
    const person = spawn(crowd)
    if (!person) return

    const spot = standOnPlatform(crowd, platform, person)
    if (!spot) {
      release(crowd, person)
      return
    }

    person.state = PassengerState.WAITING
    person.x = spot.x
    person.z = spot.z
    person.yaw = spot.yaw
    person.faceTo = spot.yaw
    person.seated = spot.seated
    person.seatY = spot.seatY
  }
}

/** Let one more person up from the concourse, if the platform is thin. */
function replenish(crowd: CrowdSim, platform: PlatformCrowd, delta: number): void {
  platform.nextArrival -= delta
  if (platform.nextArrival > 0) return

  platform.nextArrival = ARRIVAL_GAP * (0.55 + crowd.random())
  if (platform.expected >= PLATFORM_TARGET) return

  const gates = platform.stances.gates
  const gate = gates[Math.floor(crowd.random() * gates.length)]
  if (!gate) return

  const person = spawn(crowd)
  if (!person) return

  const spot = standOnPlatform(crowd, platform, person)
  if (!spot) {
    release(crowd, person)
    return
  }

  // Coming up the flight: they start out over the opening and below the deck,
  // and rise on to it as they walk off the head of it.
  person.state = PassengerState.WALKING
  person.leaving = false
  person.x = gate.fromX
  person.z = gate.fromZ
  person.lift = -EMERGE_DROP
  person.liftTo = 0
  person.yaw = Math.atan2(gate.x - gate.fromX, gate.z - gate.fromZ)
  person.faceTo = person.yaw
  person.seated = false
  person.seatY = 0

  setPath(person, gate.x, gate.z, spot.x, spot.z)
}

/* ---------------------------------------------------------------- trains */

/** Take a place aboard: a seat if they want one and there is one. */
function takeSpot(crowd: CrowdSim, train: TrainCrowd, car: number, wantSeat: boolean): number {
  const cars = train.spots.byCar
  const here = cars[car]

  if (here) {
    const first = scanFree(crowd, train.taken, wantSeat ? here.seats : here.standing)
    if (first >= 0) return first

    const second = scanFree(crowd, train.taken, wantSeat ? here.standing : here.seats)
    if (second >= 0) return second
  }

  // Nothing in the car they got into: walk up the train like anybody would.
  for (const other of cars) {
    const anywhere = scanFree(crowd, train.taken, wantSeat ? other.seats : other.standing)
    if (anywhere >= 0) return anywhere
  }
  for (const other of cars) {
    const anywhere = scanFree(crowd, train.taken, wantSeat ? other.standing : other.seats)
    if (anywhere >= 0) return anywhere
  }

  return -1
}

/** The first free place in a list, looked at from a different point each time. */
function scanFree(crowd: CrowdSim, taken: boolean[], list: readonly number[]): number {
  const count = list.length
  if (count === 0) return -1

  const start = Math.floor(crowd.random() * count)
  for (let i = 0; i < count; i++) {
    const spot = list[(start + i) % count]
    if (spot !== undefined && !taken[spot]) return spot
  }

  return -1
}

function freeSpot(train: TrainCrowd, person: Passenger): void {
  train.taken[person.spot] = false
  person.spot = -1
  train.riders--
}

/**
 * Where somebody getting on now will get off.
 *
 * Short hops are much the commoner, and a fair share of any train is going
 * somewhere past the end of the built stretch — those people stay aboard
 * when it runs off into the haze, which is exactly what they would do.
 */
function chooseAlight(crowd: CrowdSim, boardedAt: number, calls: number): number {
  if (crowd.random() < 0.22) return calls

  const remaining = calls - boardedAt - 1
  if (remaining <= 0) return calls

  let hops = 1
  while (hops < remaining && crowd.random() < 0.5) hops++

  return boardedAt + hops
}

/**
 * Catch up with what a train has done since the last step.
 *
 * Two things matter: whether it is in service at all, and whether it has just
 * opened its doors somewhere. Both are read off the train's own state machine
 * rather than told to the crowd, so the people on the platform move when that
 * train's doors move and at no other time (PLAN.md §7).
 */
function syncTrain(crowd: CrowdSim, train: TrainCrowd): void {
  const runtime = train.runtime
  const inService = runtime.state !== TrainState.IDLE

  if (inService !== train.inService) {
    train.inService = inService
    train.worked = -1

    // A working that has run off the end of the line takes everyone still
    // aboard with it; a fresh one arrives out of the haze already loaded,
    // because it has come from the part of the line that is not built.
    clearTrain(crowd, train)
    if (inService) loadTrain(crowd, train)
    return
  }

  if (!inService || train.worked === runtime.call) return
  if (!isBerthed(runtime.state) || runtime.doors < WORKING_DOORS) return

  train.worked = runtime.call
  workStop(crowd, train, runtime.call)
}

/** Everybody aboard leaves with the train when it stands down. */
function clearTrain(crowd: CrowdSim, train: TrainCrowd): void {
  for (const person of crowd.people) {
    if (person.active && person.train === train) release(crowd, person)
  }

  train.taken.fill(false)
  train.riders = 0
}

/** Put aboard the people who got on before the built line begins. */
function loadTrain(crowd: CrowdSim, train: TrainCrowd): void {
  const calls = train.stops.length
  const want = 14 + Math.floor(crowd.random() * 26)
  const cars = train.spots.byCar.length

  for (let i = 0; i < want; i++) {
    if (train.riders >= TRAIN_CAPACITY) return

    const person = spawn(crowd)
    if (!person) return

    const alightAt = chooseAlight(crowd, -1, calls)
    const wantSeat = crowd.random() < 0.65
    const index = takeSpot(crowd, train, Math.floor(crowd.random() * cars), wantSeat)
    const spot = index >= 0 ? train.spots.spots[index] : undefined

    if (!spot) {
      release(crowd, person)
      return
    }

    train.taken[index] = true
    train.riders++

    person.state = PassengerState.RIDING
    person.train = train
    person.spot = index
    person.alightAt = alightAt
    person.frame = train.carriage
    person.floorY = train.spots.floorY
    settleInSpot(crowd, person, spot)
  }
}

/** Sit or stand somebody in the place they have taken. */
function settleInSpot(crowd: CrowdSim, person: Passenger, spot: Spot): void {
  person.x = spot.x
  person.z = spot.z
  person.seated = spot.seated
  person.seatY = spot.seatY

  // Nobody stands square to the car; they face roughly across it and drift.
  person.faceTo = spot.yaw + (spot.seated ? 0 : (crowd.random() - 0.5) * 1.6)
  person.yaw = person.faceTo
  person.path.length = 0
  person.step = 0
}

/**
 * Work one station stop: everybody off, then everybody on.
 *
 * People go through a doorway one at a time, so the queue at each doorway is
 * counted separately and everyone in it is held back a beat longer than the
 * person in front. That is the whole of the crowd's choreography — it is what
 * turns thirty people stepping off at once into a train emptying.
 */
function workStop(crowd: CrowdSim, train: TrainCrowd, call: number): void {
  const stop = train.stops[call]
  if (!stop) return

  const queue = crowd.queue
  queue.fill(0)

  const spots = train.spots
  const doors = spots.doors

  for (const person of crowd.people) {
    if (!person.active || person.train !== train) continue
    if (person.state !== PassengerState.RIDING || person.alightAt !== call) continue

    const spot = spots.spots[person.spot]
    if (!spot) continue

    const berth = nearestDoor(spots, spot.x)
    const door = doors[berth]
    if (!door) continue

    person.state = PassengerState.EXITING
    person.berth = berth
    person.platform = stop
    person.hold = (queue[berth] ?? 0) * DOOR_STAGGER
    queue[berth] = (queue[berth] ?? 0) + 1

    // Out through the doorway, then a stride clear of it so the next person
    // off is not walking into their back.
    const aside = crowd.random() < 0.5 ? -0.65 : 0.65
    setPath(
      person,
      door.x,
      spots.insideZ,
      door.x,
      spots.thresholdZ,
      door.x + aside,
      spots.landingZ,
    )
  }

  const calls = train.stops.length

  for (const person of crowd.people) {
    if (!person.active || person.platform !== stop) continue
    if (person.state !== PassengerState.WAITING) continue
    if (train.riders >= TRAIN_CAPACITY) break

    const door = doors[person.berth]
    if (!door) continue

    const alightAt = chooseAlight(crowd, call, calls)
    const wantSeat = crowd.random() < (alightAt - call <= 1 ? 0.25 : 0.7)
    const index = takeSpot(crowd, train, door.car, wantSeat)
    const spot = index >= 0 ? train.spots.spots[index] : undefined
    if (!spot) break

    train.taken[index] = true
    train.riders++

    // The stance goes back into the pool, but the platform does not: they are
    // still standing on it, and if the doors beat them to it they will need it
    // back.
    freeStance(stop, person)

    // Everything from here is measured from the train, which is standing
    // still while they get on, so the conversion is exact and there is no
    // handover to make part way across the gap.
    person.x -= train.carriage.x
    person.z -= train.carriage.z
    person.frame = train.carriage
    person.floorY = spots.floorY
    person.seated = false
    person.seatY = 0

    person.state = PassengerState.BOARDING
    person.train = train
    person.spot = index
    person.alightAt = alightAt
    person.hold = BOARD_DELAY + (queue[person.berth] ?? 0) * DOOR_STAGGER
    queue[person.berth] = (queue[person.berth] ?? 0) + 1

    setPath(
      person,
      door.x,
      spots.landingZ,
      door.x,
      spots.thresholdZ,
      door.x,
      spots.insideZ,
      spot.x,
      spot.z,
    )
  }
}

/* ---------------------------------------------------------------- walking */

function setPath(person: Passenger, ...points: number[]): void {
  person.path.length = 0
  for (const value of points) person.path.push(value)
  person.step = 0
}

/** Turn towards a heading, the short way round. */
function turn(from: number, to: number, by: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2

  if (Math.abs(delta) <= by) return to
  return from + Math.sign(delta) * by
}

function stepPerson(crowd: CrowdSim, person: Passenger, delta: number): void {
  const ease = 1 - Math.exp(-LIFT_RATE * delta)
  person.lift += (person.liftTo - person.lift) * ease

  // Gone down the stairs and out of the station.
  if (person.liftTo < 0 && person.lift < -EMERGE_DROP * 0.8) {
    release(crowd, person)
    return
  }

  // The doors shutting on somebody still working their way off leaves them
  // aboard for another station, which is what would happen to them.
  if (person.state === PassengerState.EXITING && person.frame) {
    const train = person.train
    if (train && train.runtime.doors < THRESHOLD_OPEN) {
      const spot = train.spots.spots[person.spot]
      person.state = PassengerState.RIDING
      person.platform = null
      person.alightAt = Math.min(person.alightAt + 1, train.stops.length)
      person.hold = 0
      if (spot) setPath(person, spot.x, spot.z)
    }
  }

  if (person.hold > 0) {
    person.hold -= delta
    idle(person, delta)
    return
  }

  if (person.step >= person.path.length) {
    idle(person, delta)
    return
  }

  const targetX = person.path[person.step] ?? person.x
  const targetZ = person.path[person.step + 1] ?? person.z

  const dx = targetX - person.x
  const dz = targetZ - person.z
  const distance = Math.hypot(dx, dz)
  const reach = person.speed * delta

  if (distance <= reach) {
    person.x = targetX
    person.z = targetZ
    person.step += 2
    if (person.step >= person.path.length) arrive(crowd, person)
  } else {
    person.x += (dx / distance) * reach
    person.z += (dz / distance) * reach
    person.stride += reach * STRIDE_PER_METRE
    person.faceTo = Math.atan2(dx, dz)
  }

  person.pace += (1 - person.pace) * (1 - Math.exp(-PACE_RATE * delta))
  person.yaw = turn(person.yaw, person.faceTo, TURN_RATE * delta)
  person.lean = 0
}

/** Standing, sitting, or holding on while the train works. */
function idle(person: Passenger, delta: number): void {
  person.pace += (0 - person.pace) * (1 - Math.exp(-PACE_RATE * delta))
  person.yaw = turn(person.yaw, person.faceTo, TURN_RATE * delta)

  // Riding standing up: the body is pulled about by the train under it, which
  // is the one thing that tells you from inside that it is moving (PLAN.md §22).
  const frame = person.frame
  const target =
    frame && !person.seated
      ? Math.max(-LEAN_LIMIT, Math.min(LEAN_LIMIT, frame.acceleration * LEAN_PER_ACCELERATION))
      : 0

  person.lean += (target - person.lean) * (1 - Math.exp(-LEAN_RATE * delta))
}

/** Reached the end of the walk: whatever that walk was for. */
function arrive(crowd: CrowdSim, person: Passenger): void {
  person.path.length = 0
  person.step = 0

  switch (person.state) {
    case PassengerState.WALKING: {
      if (!person.leaving) {
        const platform = person.platform
        const spot = platform?.stances.stances[person.stance]
        person.state = PassengerState.WAITING
        if (spot) {
          person.faceTo = spot.yaw
          person.seated = spot.seated
          person.seatY = spot.seatY
        }
        return
      }

      // At the head of the flight: step out over it and go down.
      if (person.liftTo === 0) {
        const gate = nearestGate(person)
        person.liftTo = -EMERGE_DROP
        if (gate) setPath(person, gate.fromX, gate.fromZ)
      }
      return
    }

    case PassengerState.BOARDING: {
      const spot = person.train?.spots.spots[person.spot]
      person.state = PassengerState.RIDING
      if (spot) settleInSpot(crowd, person, spot)
      return
    }

    case PassengerState.EXITING: {
      // Out on the platform now, so the train is no longer what they are
      // measured from and their place aboard goes back into the pool.
      const frame = person.frame
      const train = person.train
      if (frame) {
        person.x += frame.x
        person.z += frame.z
      }
      if (train) freeSpot(train, person)

      person.frame = null
      person.train = null
      person.floorY = person.platform?.stances.deckY ?? person.floorY
      person.seated = false
      person.seatY = 0

      person.state = PassengerState.WALKING
      person.leaving = true

      const gate = nearestGate(person)
      if (gate) setPath(person, gate.x, gate.z)
      return
    }

    default:
      return
  }
}

/** The way off the platform they are nearest to. */
function nearestGate(person: Passenger) {
  const gates = person.platform?.stances.gates
  if (!gates || gates.length === 0) return null

  let best = gates[0] ?? null
  let nearest = Number.POSITIVE_INFINITY

  for (const gate of gates) {
    const distance = Math.hypot(gate.x - person.x, gate.z - person.z)
    if (distance < nearest) {
      nearest = distance
      best = gate
    }
  }

  return best
}
