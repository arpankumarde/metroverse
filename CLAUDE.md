# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

The app is scaffolded and the 3D stack is installed, but no feature code exists yet: `src/App.tsx`
is a Phase 0 smoke scene (a lit floor + box with pointer-lock mouse look) that proves the
React -> R3F -> three pipeline renders. `PLAN.md` is the authoritative spec — re-read the relevant
section before building a subsystem.

Stack: Vite 8 (Rolldown) + React 19.2 + TypeScript 6, with the React Compiler enabled via
`@rolldown/plugin-babel`, and oxlint for linting.

## Commands

```bash
npm run dev      # dev server with HMR, http://localhost:3000
npm run build    # tsc -b (project references) then vite build -> dist/
npm run preview  # serve the production build, http://localhost:3000
npm run lint     # oxlint
```

**No test runner is configured.** If tests are added, record the runner and the single-test
invocation here.

## Hard constraints

- **Node ecosystem only.** Everything ships as npm packages run under Node — no Python, Rust, Go,
  Docker, or other toolchains for build, assets, or scripts.
- **Frontend only, no backend.** There is no server, no API, no database. All Metro network data is
  static configuration bundled into the client; all state lives in the browser. The app must be a
  fully static build servable from a plain file host.
- **Port 3000** for both `dev` and `preview`, with `strictPort: true` in `vite.config.ts` so a
  collision fails loudly instead of silently moving to 3001.
- **Do not bump React past 19.2.x.** `@react-three/fiber@9` declares a peer range of
  `react >=19 <19.3`, so `react`/`react-dom` are pinned to `~19.2.8`. Raising them breaks
  `npm install` with ERESOLVE.
- **No TypeScript `enum` or parameter properties.** `tsconfig.app.json` sets
  `erasableSyntaxOnly: true` (and `strict: true`). Model the train and passenger state machines
  (`PLAN.md` §7, §18) as `const` objects plus a derived union type, not `enum`.

## What this project is

A first-person 3D Delhi Metro simulator ("Flight Simulator, but for the Delhi Metro"). The player's
camera is their eyes inside a moving Metro coach. Three framings are explicitly out of scope and
should be pushed back on if a change drifts toward them: a metro map app, a code/data visualization,
or a third-person train game. See `PLAN.md` §35.

## Architecture

The plan prescribes a layered split under `src/` — `components/`, `scenes/`, `train/`, `stations/`,
`passengers/`, `world/`, `metro/`, `ui/`, `audio/`, `systems/`, `data/`. The non-obvious constraints
that span multiple of these:

**Metro network is data, not code.** Stations, lines, ordering, interchanges and line colors live in
`data/` as typed configuration (`Station`, `MetroLine`, `Train`, `Journey`, `Passenger`,
`Environment`). Adding a station must require only a data edit — never a change to a component.
Never hard-code station logic into rendering components (`PLAN.md` §9, §33).

**The train is a state machine, and it is the source of truth.** States: `IDLE`, `DOORS_OPEN`,
`DOORS_CLOSING`, `DEPARTING`, `ACCELERATING`, `CRUISING`, `BRAKING`, `ARRIVING`, `STOPPED`. The
in-cabin digital display, the HUD, the announcements, and the player's dot on the Metro map are all
derived from this one journey/train state — they are not independently driven. The train must
physically travel between stations; never teleport it (§7, §16, §17).

**Rendering is separate from game state.** Keep simulation (movement, journey progression, passenger
state machines, audio triggers) out of the R3F components that draw things. Passengers use trivial
state machines (`WAITING`/`BOARDING`/`RIDING`/`EXITING`/`WALKING`) and instanced rendering, not AI.

**Line identity propagates.** Switching lines must change the visual identity throughout — train
interior, HUD, map, station indicators — driven by the line's color in the network data, not by
recoloring one mesh (§10).

**Two camera/control regimes.** Pointer-lock first-person mouse-look while seated in the train
(click to enter, ESC to exit); WASD walking with collision when off the train in stations and the
interchange. Modes `C` (cinematic) and `G` (god/network view) temporarily detach the camera and must
return cleanly to first person. `M` opens the map.

## Build order

Follow the MVP phasing in `PLAN.md` §30 rather than building breadth-first. Prove the core loop
first — `PLAYER → TRAIN → MOVE → STATION → STOP → DOORS → NEXT STATION` — before spending effort on
assets, weather, or polish (§34). The reference journey to keep working end-to-end is
Rajiv Chowk → Mandi House → Yamuna Bank → Noida Sector 15/16/18 (§31). Only one interchange
(Rajiv Chowk) is in MVP scope, and it should be highly polished rather than duplicated (§11).

## Performance budget

Target 60 FPS on a normal modern laptop. The plan explicitly trades geometric detail for lighting,
materials and camera feel: low-poly modular assets, instancing, LOD, baked/static lighting, frustum
culling. Physical effects (acceleration lean, brake pitch, vibration) must stay subtle — the goal is
realism, not arcade feedback (§22, §28).
