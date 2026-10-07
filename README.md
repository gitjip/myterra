# MyTerra

MyTerra is a browser based 2D tile sandbox. M3 adds the first gameplay loop:
mine tiles, place blocks, open and close doors, and pick up the drops. The
resident test world, player physics and survival stats come from M1/M2.

## Run locally

```sh
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

- Move: `A`/`D` or left/right arrows
- Jump / swim up: `Space`
- Swim direction: `W`/`S` or up/down arrows
- Mine (hold): left mouse
- Place / open a door: right mouse
- Select hotbar slot: `1`–`0`
- Zoom: `+` / `-`
- Fullscreen: `F11`
- Developer overlay (FPS, budgets, inventory, player box): `F3`
- Debug: `F7` empties hunger, `F8` eats raw meat

The test scene starts you with a wood pickaxe, axe, shovel, torches, doors and
some dirt and stone. It has flat ground, a stone wall and a water pool to the
right of spawn.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run bench
npm run build
```

The build is static and uses no runtime network requests or external assets.
