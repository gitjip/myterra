# MyTerra

MyTerra is a browser based 2D tile sandbox. M11 closes the survival loop:
death and respawn, edible food, and rabbits. Content expansion and the final
UI come next.

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
- Eat the held food: right mouse
- Place / open a door / use a station / fill or pour a bucket: right mouse
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

## Survival

Health, hunger and breath drain and recover on their own. Hold raw or cooked
meat and right-click to eat it. Dying shows a death screen; Respawn returns you
to the world spawn with full stats while keeping your inventory. Rabbits wander
grassy surface in the daytime and flee when you get close; hit one for raw meat.

## Combat and enemies

Holding a sword and pressing left mouse swings it in a short arc in front of
you. Hold a bow (with arrows in the ammo slot) and hold left mouse to charge,
then release to fire. Zombies walk toward you and jump over walls; slimes hop;
skeletons fire bone arrows; spiders cling to walls and ceilings. Contact damage
is reduced by equipped armor. Kills drop gel, bones, silk and meat.

## Crafting and smelting

Mine wood and stone, craft a workbench, then a wood pickaxe; mine ore, smelt
it in a furnace into ingots, and craft stone and iron tools and swords. Recipes
are shape-independent and filtered by the station in reach. Tools have three
tiers whose mining speed increases; using the wrong tool class still costs time
and drops nothing.

## Liquids and sand

Water and lava are finite volumes that flow down, diagonally and sideways until
level, then sleep. Where they meet, water and lava become stone and obsidian.
Sand falls one tile at a time and pushes water aside. An empty bucket fills from
a liquid cell and pours back into air on right-click. The player swims and
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
