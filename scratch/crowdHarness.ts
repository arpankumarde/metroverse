import { BLUE_CORRIDOR } from '../src/data/corridor'
import { DMRC_STANDARD_GAUGE } from '../src/data/rollingStock'
import { BLUE_LINE_SERVICE } from '../src/data/service'
import { createLineService, stepRoad } from '../src/train/lineService'
import { driveCarriage } from '../src/train/carriage'
import { worldX } from '../src/train/line'
import { TrainState } from '../src/train/service'
import { createCrowd, PassengerState, stepCrowd } from '../src/passengers/crowd'

const SERVICE = createLineService(BLUE_CORRIDOR, BLUE_LINE_SERVICE, DMRC_STANDARD_GAUGE)
const crowd = createCrowd(BLUE_CORRIDOR, SERVICE, DMRC_STANDARD_GAUGE)

function census() {
  const by: Record<string, number> = {}
  let active = 0
  let framed = 0
  for (const p of crowd.people) {
    if (!p.active) continue
    active++
    if (p.frame) framed++
    by[p.state] = (by[p.state] ?? 0) + 1
  }
  return { active, framed, ...by }
}

console.log('t=0', JSON.stringify(census()))

const STEP = 1 / 60
let boarded = 0
let alighted = 0
let left = 0
const seen = new Map<number, string>()
const since = new Map<number, number>()

// Watch the pool for transitions, so the loop is actually observed end to end.
for (let frame = 0; frame < 60 * 60 * 12; frame++) {
  for (const road of SERVICE.values()) stepRoad(road, STEP)

  // What TrainService does every frame in the app: put the carriage where the
  // simulation says its train is. The crowd is measured from it.
  for (const road of SERVICE.values()) {
    road.trains.forEach((runtime, slot) => {
      const carriage = road.carriages[slot]!
      driveCarriage(carriage, worldX(road.schedule, runtime.travel), 0, road.schedule.offsetZ, STEP)
      carriage.inactive = runtime.state === TrainState.IDLE
    })
  }

  stepCrowd(crowd, STEP)

  for (let i = 0; i < crowd.people.length; i++) {
    const p = crowd.people[i]!
    const was = seen.get(i)
    const now = p.active ? p.state : 'GONE'
    if (was !== now) {
      if (now === PassengerState.BOARDING) boarded++
      if (now === PassengerState.EXITING) alighted++
      if (was && was !== 'GONE' && now === 'GONE') left++
      seen.set(i, now)
      since.set(i, frame)
    }
  }

  if (frame % (60 * 120) === 0 && frame > 0) {
    console.log(`t=${(frame * STEP).toFixed(0)}s`, JSON.stringify(census()),
      `boarded=${boarded} alighted=${alighted} gone=${left}`)
  }
}

// Sanity: nobody stranded in a transient state, nobody left in a standby train.
let stuck = 0
let ghost = 0
for (const p of crowd.people) {
  if (!p.active) continue
  if (p.state === PassengerState.BOARDING || p.state === PassengerState.EXITING) stuck++
  if (p.train && p.train.runtime.state === TrainState.IDLE) ghost++
}
console.log('final', JSON.stringify(census()), 'midDoorway=', stuck, 'inStandbyTrain=', ghost)

// Riders counted on each train must match the people who think they are on it.
for (const [n, t] of crowd.trains.entries()) {
  let real = 0
  for (const p of crowd.people) if (p.active && p.train === t) real++
  if (real !== t.riders) console.log('MISMATCH train', n, 'riders=', t.riders, 'actual=', real)
}
let takenCount = 0
for (const t of crowd.trains) takenCount += t.taken.filter(Boolean).length
console.log('spots held =', takenCount)

// Longest anybody has sat in one state without it changing: a stuck agent shows
// up here as a number that just keeps growing.
const worst = new Map<string, number>()
for (let i = 0; i < crowd.people.length; i++) {
  const p = crowd.people[i]!
  if (!p.active) continue
  const age = (60 * 60 * 12 - (since.get(i) ?? 0)) / 60
  const key = p.state
  if (age > (worst.get(key) ?? 0)) worst.set(key, age)
}
console.log('longest unchanged, seconds:', JSON.stringify(Object.fromEntries(worst)))

// Everybody aboard has to be inside the car they are supposedly in.
let outside = 0
let offFloor = 0
for (const p of crowd.people) {
  if (!p.active || !p.frame) continue
  if (Math.abs(p.x) > 90 || Math.abs(p.z) > 3.2) outside++
  if (Math.abs(p.floorY - 1.1) > 1e-6) offFloor++
}
console.log('aboard but outside the train =', outside, ' wrong floor =', offFloor)

let onPlatform = 0
let wrongDeck = 0
for (const p of crowd.people) {
  if (!p.active || p.frame) continue
  onPlatform++
  if (Math.abs(p.floorY - 1.1) > 1e-6) wrongDeck++
}
console.log('on a platform =', onPlatform, ' wrong deck height =', wrongDeck)

let seatedRiders = 0
let standingRiders = 0
for (const p of crowd.people) {
  if (!p.active || p.state !== PassengerState.RIDING) continue
  if (p.seated) seatedRiders++
  else standingRiders++
}
console.log('riding: seated =', seatedRiders, ' standing =', standingRiders)
