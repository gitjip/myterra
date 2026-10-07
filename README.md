# MyTerra

MyTerra is a browser based 2D tile sandbox. The project is currently at M0:
the fixed timestep shell, deterministic random helpers, profiler, debug overlay,
and headless benchmark are in place. Terrain and gameplay arrive in later
milestones.

## Run locally

```sh
npm install
npm run dev
```

Open the local Vite URL shown in the terminal. The M0 canvas is an empty test
scene; press `F3` to toggle the developer overlay.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run bench
npm run build
```

The build is static and uses no runtime network requests or external assets.
