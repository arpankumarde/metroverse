# Delhi Metro · 3D Simulator

A first-person 3D Delhi Metro simulator built with React, Three.js and React Three Fiber.
The camera is the player's eyes inside a moving Metro coach.

The full product and technical blueprint lives in [`PLAN.md`](./PLAN.md).

## Requirements

- Node.js 22+ (developed on 22.15)
- npm 10+

## Getting started

```bash
npm install
npm run dev
```

The app runs at <http://localhost:3000>.

## Scripts

| Script            | What it does                                        |
| ----------------- | --------------------------------------------------- |
| `npm run dev`     | Vite dev server with HMR on port 3000               |
| `npm run build`   | Type-check (`tsc -b`) then produce a static build   |
| `npm run preview` | Serve the production build on port 3000             |
| `npm run lint`    | Run oxlint                                          |

No test runner is configured yet.

## Notes

This is a frontend-only, fully static app — there is no server, API or database. The Metro network
is static configuration bundled into the client.

React is pinned to `~19.2.8`: `@react-three/fiber@9` declares a peer range of `react >=19 <19.3`,
so bumping to 19.3 breaks installation.
