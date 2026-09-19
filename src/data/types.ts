/**
 * Typed configuration for the Metro network (PLAN.md §9, §33).
 *
 * Everything the renderer needs to draw a place lives here as data. Adding or
 * reshaping a station must be a data edit, never a component edit.
 */

/** Which side of its track a platform sits on, looking along the travel direction. */
export const PlatformSide = {
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
} as const

export type PlatformSide = (typeof PlatformSide)[keyof typeof PlatformSide]

/**
 * A name as it appears on DMRC signage: Devanagari above, Latin below. Every
 * sign in the station is bilingual, so names travel in pairs everywhere.
 */
export interface BilingualName {
  hi: string
  en: string
}

export interface MetroLine {
  id: string
  name: BilingualName
  /** The line's colour. Everything that shows line identity reads it from here (PLAN.md §10). */
  color: string
}

export interface TrackConfig {
  id: string
  /** Signed Z offset of the track centreline from the station centreline, in metres. */
  offset: number
  /** Which way trains work along this road: +1 travels towards +X, -1 towards -X. */
  direction: 1 | -1
  /** Rail centre-to-centre, in metres. Standard gauge 1.435, broad gauge 1.676. */
  gauge: number
  /** Concrete sleeper pitch, in metres. */
  sleeperSpacing: number
}

export interface PlatformConfig {
  id: string
  /** The track this platform serves. */
  trackId: string
  /** As printed on the hanging platform-number sign. */
  number: string
  /** Where trains from this platform are headed; shown on the destination board. */
  towards: BilingualName
  /** Length along the track, in metres. DMRC 8-coach platforms are ~180 m. */
  length: number
  /** Depth from the track-side edge back into the concourse, in metres. */
  width: number
  /** Deck height above rail top, in metres. DMRC standard is 1.1 m. */
  height: number
  side: PlatformSide
}

/**
 * The barrel-vault canopy over an elevated station: a run of tubular steel
 * arch ribs carrying a curved roof shell, open at both ends and at the sides
 * above the springing line. See `references/` — this is the standard DMRC
 * elevated platform shelter.
 *
 * The vault is a half-ellipse about the station centreline, so it is fully
 * described by how wide it springs, how high it springs and how far it rises.
 */
export interface CanopyConfig {
  /** How much of the platform is sheltered, in metres. */
  length: number
  /** |Z| of the springing line, i.e. where the arch meets its columns. */
  halfSpan: number
  /** Y of the springing line above rail top. */
  springY: number
  /** Height of the crown above the springing line. */
  rise: number
  /** Thickness of the roof shell. */
  thickness: number
  /** Spacing of the arch ribs along the track, in metres. */
  ribSpacing: number
  /** Radius of the tubular rib sections. */
  ribRadius: number
}

export interface StationConfig {
  id: string
  /** Display name as printed on station signage. */
  name: BilingualName
  lineId: string
  /** Platforms, each naming a running line of the corridor it serves. */
  platforms: PlatformConfig[]
  canopy: CanopyConfig
}

/** A station and where it sits on the line, in metres along the corridor. */
export interface CorridorStation {
  station: StationConfig
  x: number
}

/**
 * A point on the vertical alignment of a corridor: the height of rail top at
 * a chainage, measured from rail top on the viaduct.
 *
 * The line is not flat. It runs on viaduct at y = 0, and dives into tunnel
 * where the corridor says it does (PLAN.md §6, §19). Between two points the
 * grade is eased rather than linear, so a ramp leaves and meets the level at
 * zero gradient and there is no kink at either knuckle — which is both how a
 * railway vertical curve is built and what keeps a train from visibly
 * snapping to a new pitch as it reaches a portal.
 */
export interface GradePoint {
  /** Chainage along world +X. */
  x: number
  /** Rail top at that chainage, relative to rail top on the viaduct. */
  y: number
}

/**
 * The vertical alignment of a corridor: grade points in chainage order, held
 * flat beyond either end.
 *
 * Stations are all built at viaduct level, so an alignment must be back at
 * y = 0 and level for at least half a platform either side of every station
 * on the corridor. `checkAlignment` in `alignment.ts` enforces that.
 */
export type VerticalAlignment = readonly GradePoint[]

/**
 * A built stretch of a line: the running lines, and the stations strung along
 * them in order (PLAN.md §9).
 *
 * The running lines belong to the corridor rather than to any one station,
 * because they are continuous through all of them — which is what lets a train
 * work from one station to the next instead of vanishing at the end of a
 * platform (PLAN.md §7).
 *
 * Chainage is measured along world +X, so a station's world transform is its
 * `x` and nothing else. Extending the corridor is an edit to the table in
 * `src/data/corridor.ts`.
 */
export interface CorridorConfig {
  id: string
  lineId: string
  tracks: TrackConfig[]
  /** Stations in chainage order. */
  stations: CorridorStation[]
  /**
   * How the line rises and falls along its length. Absent means dead level
   * on viaduct the whole way.
   */
  alignment?: VerticalAlignment
  /**
   * How far the built line runs beyond the outermost stations, in metres.
   * Long enough that a train appears and disappears deep inside the haze.
   */
  tail: number
}

/**
 * The saloon: the inside of a car, which is where the player actually is
 * (PLAN.md §4, §5). Everything here is in metres, measured from the saloon
 * floor unless the name says otherwise.
 *
 * See `references/metro inside/` — longitudinal stainless benches down both
 * sides under the windows, floor-to-ceiling grab poles, two horizontal rails
 * with hanging loops, a flat ceiling with the air-conditioning duct down the
 * middle, and an open gangway through to the next car.
 */
export interface SaloonConfig {
  /** Floor to ceiling. */
  ceilingHeight: number
  /** How far the air-conditioning duct hangs below the ceiling, and how wide. */
  ductDrop: number
  ductWidth: number
  /** Longitudinal bench: top of the seat pan, and how far it reaches inboard. */
  seatHeight: number
  seatDepth: number
  /** How high the moulded back rises above the pan. */
  seatBackHeight: number
  /** Stainless grab poles running floor to ceiling. */
  poleRadius: number
  /** Horizontal grab rails: height above the floor, and offset from the centreline. */
  railHeight: number
  railOffset: number
  /** Hanging grab handles: spacing along a rail, and the size of the loop. */
  handleSpacing: number
  handleRadius: number
  /** The opening through a car's end wall into the next car. */
  gangwayWidth: number
  gangwayHeight: number
}

/**
 * The streamlined nose on the outer end of each driving car (PLAN.md §22).
 *
 * The nose is a fairing hung off the end of the car body rather than a slice
 * taken out of it, so a fleet can be given a blunter or a longer one without
 * anything else about the car — its doors, its saloon, where it stops —
 * changing at all. It reaches `length` beyond the end of the body and runs
 * out into a blade between `tipBottomY` and `tipTopY`.
 */
export interface NoseConfig {
  /** How far the nose reaches beyond the end of the driving car's body. */
  length: number
  /** Half-width of the blade the nose runs out into. */
  tipHalfWidth: number
  /** Top and bottom of that blade, above rail top. */
  tipTopY: number
  tipBottomY: number
}

/**
 * A class of rolling stock. Dimensions are body dimensions in metres; heights
 * are measured up from rail top unless the name says otherwise.
 */
export interface RollingStockConfig {
  id: string
  /** Track gauge the stock runs on, in metres. Sets the wheel spacing. */
  gauge: number
  carCount: number
  /** Body length of one car. */
  carLength: number
  /** Coupler gap between two car bodies. */
  carGap: number
  carWidth: number
  /** Saloon floor above rail top. Must match platform height for a level boarding. */
  floorHeight: number
  /** Floor to the top of the body sides. */
  bodyHeight: number
  /** Height of the roof crown above the body sides. */
  roofHeight: number
  /** How much narrower the flat of the roof is than the body, across both sides. */
  roofInset: number
  /**
   * Bottom of the streamlined fairing under the body sides, above rail top.
   * The skirt closes the gap between the body and the track everywhere the
   * bogies do not need the room, and the nose flares back into it.
   */
  skirtY: number
  doorsPerSide: number
  doorWidth: number
  /** Floor to the top of the door. */
  doorHeight: number
  /** Floor to the bottom of the side windows. */
  windowSill: number
  windowHeight: number
  windowWidth: number
  /** Vertical centre of the line-colour band, above the floor. */
  bandCenter: number
  bandHeight: number
  wheelDiameter: number
  /** Distance between the two bogie centres of one car. */
  bogiePivotSpacing: number
  /** Distance between the two axles of one bogie. */
  bogieWheelbase: number
  /** The streamlined nose on each driving end (PLAN.md §22). */
  nose: NoseConfig
  /** The inside of the car, which is the part the player rides in. */
  saloon: SaloonConfig
}

/**
 * How a line is worked: what its trains can do, and the timings of one station
 * stop (PLAN.md §7).
 *
 * Retiming a stop — a longer dwell, a gentler brake, a tighter headway — is a
 * data edit here. The movement code reads these numbers and owns none of them.
 */
export interface ServiceConfig {
  /** Running speed on the approach to the station, in m/s. */
  lineSpeed: number
  /** Service acceleration, in m/s². */
  acceleration: number
  /** Service braking rate, in m/s². */
  braking: number
  /** Speed below which the train counts as ARRIVING, i.e. crawling on to the mark. */
  arrivingSpeed: number
  /** Standing at the mark with the doors still shut, in seconds. */
  stopPause: number
  /** How long one door leaf takes to run from shut to fully open, in seconds. */
  doorTravel: number
  /** How long the doors stand fully open, in seconds. */
  dwell: number
  /** Doors shut to the train pulling away, in seconds. */
  departPause: number
  /** Interval between successive workings leaving the start of a road, in seconds. */
  headway: number
}
