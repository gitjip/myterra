# MyTerra

MyTerra is a browser based 2D tile sandbox. M1 now provides a resident test
world, procedural tile atlas, camera, cached chunks, and a terrain renderer on
top of the fixed timestep shell. Player physics and gameplay arrive in later
milestones.

## Run locally

```sh
npm install
npm run dev
```

Open the local Vite URL shown in the terminal. The M1 canvas contains a flat
test scene and stone wall. Use `WASD` or arrow keys to pan, `+`/`-` for integer
zoom, `F11` for fullscreen, and `F3` to toggle the developer overlay.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run bench
npm run build
```

The build is static and uses no runtime network requests or external assets.
