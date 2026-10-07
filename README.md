# MyTerra

MyTerra is a browser based 2D tile sandbox. M5 adds seed-driven world
generation: biomes, caves, ore veins, trees and static pools, plus a main menu
and new-world flow. Lighting, liquid simulation and saving come next.

## Run locally

```sh
npm install
npm run dev
```

Open the local Vite URL shown in the terminal. The main menu creates a world
(name, size, seed, mode); generation shows progress and can be cancelled.

- Move: `A`/`D` or left/right arrows
- Jump / swim up / fly up: `Space` / `W`
- Swim or fly down: `S`
- Mine (hold): left mouse
- Place / open a door: right mouse
- Select hotbar slot: `1`–`0`
- Toggle Survival / Creative: `F6`
- Creative palette: `1`–`9` or mouse wheel
- Zoom: `+` / `-`
- Fullscreen: `F11`
- Return to main menu: `Esc`
- Developer overlay (FPS, budgets, world seed, mode, inventory): `F3`
- Debug: `F7` empties hunger, `F8` eats raw meat, `F9` spills water at the cursor

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run bench
npm run build
```

The build is static and uses no runtime network requests or external assets.
