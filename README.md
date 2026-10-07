# MyTerra

MyTerra is a browser based 2D tile sandbox. M10 adds combat and enemies:
sword swings, zombies and slimes that chase and bite, and loot drops. The
death/respawn loop and passive creatures come next.

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
- Attack with a sword (hold): left mouse
- Place / open a door / use a station: right mouse
- Crafting (near a workbench): `E`
- Select hotbar slot: `1`–`0`
- Toggle Survival / Creative: `F6`
- Creative palette: `1`–`9` or mouse wheel
- Zoom: `+` / `-`
- Fullscreen: `F11`
- Return to main menu (saves first): `Esc`
- Developer overlay (FPS, budgets, mode, palette, inventory, aimed tile): `F3`
- Debug: `F7` empties hunger, `F8` eats raw meat, `F9` spills water at the cursor, `F10` recomputes lighting

## Saving

Worlds save to IndexedDB automatically every 60 seconds, when the tab is
hidden, when leaving to the menu, and on unload. Each save rotates between two
slots so a crash mid-write cannot corrupt the loadable copy. A save only stores
the tiles and liquids you changed plus the player and inventory; terrain and
background walls are regenerated from the seed. Loading re-runs generation on
the same seed and applies the diff.

## Combat and enemies

Holding a sword and pressing left mouse swings it in a short arc in front of
you. Zombies walk toward you and jump over walls; slimes hop. Both deal contact
damage and are knocked back when hit, then drop gel (and the odd piece of raw
meat). Enemies spawn only in the dark within 128 tiles and vanish past 192.

## Crafting and smelting

Mine wood and stone, craft a workbench, then a wood pickaxe; mine ore, smelt
it in a furnace into ingots, and craft stone and iron tools and swords. Recipes
are shape-independent and filtered by the station in reach. Tools have three
tiers whose mining speed increases; using the wrong tool class still costs time
and drops nothing.

## Liquids and sand

Water and lava are finite volumes that flow down, diagonally and sideways until
level, then sleep. Where they meet, water and lava become stone and obsidian.
Sand falls one tile at a time and pushes water aside. The player swims and
holds breath in water, and takes damage in lava. `F9` spills water at the
cursor for testing.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run bench
npm run build
```

The build is static and uses no runtime network requests or external assets.
