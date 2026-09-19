import { NearCamera } from '../components/NearCamera'
import { corridorAlignment } from '../data/alignment'
import { BLUE_CORRIDOR, corridorEnd, corridorStart } from '../data/corridor'
import { BLUE_LINE } from '../data/lines'
import { DMRC_STANDARD_GAUGE } from '../data/rollingStock'
import { Passengers } from '../passengers/Passengers'
import { PlatformAnnouncements } from '../stations/PlatformAnnouncements'
import { RunningLines } from '../stations/RunningLines'
import { Station } from '../stations/Station'
import { Viaduct } from '../stations/Viaduct'
import { stationHalfWidth } from '../stations/geometry'
import { ServiceClock } from '../train/ServiceClock'
import { TrainService } from '../train/TrainService'
import { City } from '../world/City'
import { Daylight, GROUND_Y } from '../world/Daylight'
import { Tunnel } from '../world/Tunnel'
import { tunnelStretches } from '../world/tunnelGeometry'
import { SERVICE } from './blueLine'

/**
 * The built stretch of the Blue Line: Rajiv Chowk out to Yamuna Bank, with a
 * service working both roads (PLAN.md §7, §8, §30 phase 3).
 *
 * Six stations strung along six kilometres of line, and trains that drive the
 * whole way between them — a train that pulls out of Rajiv Chowk is the same
 * train that runs into Barakhamba Road eighty seconds later. Nothing is
 * teleported and nothing is faked at the edges: what the haze hides is still
 * there, and still running.
 *
 * The line is not all viaduct. It follows the corridor's alignment, which
 * takes it down off the deck and into a box tunnel twice along this stretch,
 * and the structure follows suit: deck and piers where the line is in the
 * air, bore where it is under the street, and a portal where one becomes the
 * other. Neither knows where the tunnels are — both read it off the same
 * alignment (PLAN.md §6, §19).
 *
 * Around all of it is the Delhi the line was built through: the arterial road
 * under the viaduct, its traffic and its trees, and the frontage either side
 * of it, named where the real buildings are named.
 */
const ALIGNMENT = corridorAlignment(BLUE_CORRIDOR)

/** Where the line runs covered, worked out once from the alignment. */
const COVERED = tunnelStretches(BLUE_CORRIDOR, ALIGNMENT)

export function LineScene() {
  const first = BLUE_CORRIDOR.stations[0]
  const halfWidth = first ? stationHalfWidth(first.station, BLUE_CORRIDOR.tracks) : 0

  return (
    <>
      <Daylight />

      <City corridor={BLUE_CORRIDOR} />

      <Viaduct
        halfWidth={halfWidth + 0.7}
        from={corridorStart(BLUE_CORRIDOR)}
        to={corridorEnd(BLUE_CORRIDOR)}
        groundY={GROUND_Y}
        alignment={ALIGNMENT}
        covered={COVERED}
      />

      <Tunnel
        corridor={BLUE_CORRIDOR}
        alignment={ALIGNMENT}
        halfWidth={halfWidth + 0.7}
        groundY={GROUND_Y}
      />

      <RunningLines corridor={BLUE_CORRIDOR} alignment={ALIGNMENT} />

      <ServiceClock roads={SERVICE}>
        {BLUE_CORRIDOR.stations.map(({ station, x }) => (
          <NearCamera key={station.id} x={x} reach={station.canopy.length / 2}>
            <group position={[x, 0, 0]}>
              <Station station={station} tracks={BLUE_CORRIDOR.tracks} line={BLUE_LINE} />
            </group>
          </NearCamera>
        ))}

        {[...SERVICE.values()].map((road) =>
          road.trains.map((_, slot) => (
            <TrainService
              key={`${road.schedule.trackId}-${slot}`}
              stock={DMRC_STANDARD_GAUGE}
              line={BLUE_LINE}
              trackId={road.schedule.trackId}
              slot={slot}
            />
          )),
        )}

        <PlatformAnnouncements corridor={BLUE_CORRIDOR} line={BLUE_LINE} />

        {/* Last, so the people riding a train are placed against where that
            train got to this frame rather than where it was on the last one. */}
        <Passengers corridor={BLUE_CORRIDOR} roads={SERVICE} stock={DMRC_STANDARD_GAUGE} />
      </ServiceClock>
    </>
  )
}
