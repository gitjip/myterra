# MyTerra

MyTerra is a browser based 2D tile sandbox. M4 adds the creative sandbox: a
mode switch, flight, instant mining and placing, and a raw-tile build palette
for assembling test scenes. The survival loop, world generation, lighting and
liquid come next.

## Run locally

```sh
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

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
- Developer overlay (FPS, budgets, mode, palette, inventory): `F3`
- Debug: `F7` empties hunger, `F8` eats raw meat, `F9` spills water at the cursor

The test scene starts you with a wood pickaxe, axe, shovel, torches, doors and
some dirt and stone. It has flat ground, a stone wall and a water pool.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run bench
npm run build
```

The build is static and uses no runtime network requests or external assets.
