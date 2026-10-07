# MyTerra

MyTerra is a browser based 2D tile sandbox. M2 adds a physics-driven player
with health, hunger and breath on top of the M1 resident world, camera and
terrain renderer. Mining, placing and the inventory arrive in M3.

## Run locally

```sh
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

- Move: `A`/`D` or left/right arrows
- Jump / swim up: `Space`
- Swim direction: `W`/`S` or up/down arrows
- Zoom: `+` / `-`
- Fullscreen: `F11`
- Developer overlay (FPS, budgets, player box): `F3`
- Debug: `F7` empties hunger, `F8` eats raw meat

The test scene has flat ground, a stone wall and a water pool to the right of
spawn for checking swimming and breath.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run bench
npm run build
```

The build is static and uses no runtime network requests or external assets.
