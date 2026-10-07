# MyTerra

MyTerra is a browser based 2D tile sandbox. M6 adds saving: worlds persist to
IndexedDB with rotating slots, autosave and a Continue entry on the main menu.
Lighting and liquid simulation come next.

## Run locally

```sh
npm install
npm run dev
```

Open the local Vite URL shown in the terminal. The main menu creates a world
(name, size, seed, mode); generation shows progress and can be cancelled.
Continue reloads the most recent world.

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
- Return to main menu (saves first): `Esc`
- Developer overlay (FPS, budgets, mode, palette, inventory, aimed tile): `F3`
- Debug: `F7` empties hunger, `F8` eats raw meat, `F9` spills water at the cursor

## Saving

Worlds save to IndexedDB automatically every 60 seconds, when the tab is
hidden, when leaving to the menu, and on unload. Each save rotates between two
slots so a crash mid-write cannot corrupt the loadable copy. A save only stores
the tiles and liquids you changed plus the player and inventory; terrain and
background walls are regenerated from the seed. Loading re-runs generation on
the same seed and applies the diff.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run bench
npm run build
```

The build is static and uses no runtime network requests or external assets.
