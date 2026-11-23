# Solmar Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/monicazhy949/makefun-entries/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/monicazhy949/makefun-entries/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01): **Solmar Bay**, a sun-soaked coastal city where you run nine jobs for the fixer Vera Solano, outrun the SBPD, and end the night as Street King.

## Play

Open `game/index.html` in a desktop browser — no server, no network, no build step.

- **WASD** — drive / walk
- **E** — get in a car (or get out)
- **Mouse** — aim, **click** — shoot
- **F** — Spray & Save (repaint the car, clear the wanted level, priced per star)
- **P** — pause, **H** — help, **L** — snapshot

## The city

A road grid with buildings, parks, the waterfront, and named places: the pier, the bank, the hospital, the casino, the warehouse, the garage (Spray & Save), the police station, the taxi stand, and two safehouses. Everything runs on a seeded, deterministic RNG, so the same seed plays the same city.

## Systems

- **Vehicles** — sedans, taxis, sports cars, trucks and police cruisers, each with its own speed and handling; cars take damage, smoke and wreck; every car has a unique id.
- **Wanted** — crimes raise heat, heat sets the star level (1–5). Cop cars chase and ram, foot cops chase and arrest, and heat only cools when no cop can see you. Getting busted costs a fine and a trip to the station; getting wasted costs a fine and a trip to the hospital.
- **Combat** — shoot rivals with the mouse; kills only count while a kill step is active.
- **Pedestrians** — the city walks its sidewalks and runs when shots ring out.
- **Money, health, armour** — jobs pay out, the HUD tracks it all, and a minimap keeps the job marker in view.
- **Save** — progress autosaves to localStorage every ten seconds.

## The nine jobs

| # | Job | Pay | The work |
|---|-----|-----|----------|
| 1 | First Fare | $550 | Take the taxi from the stand to the casino |
| 2 | Hot Wheels | $500 | Steal a ride and bring it to the garage |
| 3 | The Drop | $700 | Pick up the crate on the pier and deliver it |
| 4 | Heat Wave | $800 | Trip the bank alarm and get out with the heat on |
| 5 | Dockside Deal | $1,240 | Meet at the pier and deal with three rivals |
| 6 | The Big Score | $2,500 | Hit the bank, then the warehouse, then vanish |
| 7 | Night Shift | $1,500 | Taxi → wait → hospital → casino |
| 8 | Warehouse Raid | $1,800 | Warehouse → pier → three rivals → safehouse |
| 9 | Street King | $3,000 | Survive 20 seconds at two stars, lose the cops, reach the garage |

Finish all nine and the final take is **$12,590**.

## Files

- `game/index.html` — the page; open it and play
- `game/src/` — the game, one module per system (`game.js` loop, `world.js` city, `vehicles.js`, `player.js`, `police.js`, `combat.js`, `missions.js`, `pedestrians.js`, `render.js`, `hud.js`, `input.js`, `audio.js`, `save.js`, `shots.js`, `config.js`, `random.js`, `main.js`)
- `main.ts` — the entry point: copies `game/` and `screenshots/` to `/output` and writes `dossier.json` (Node 22, standard library only)
- `screenshots/` — four dossier shots; the first by name is the cover

## Run the entry

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`out/` then holds `game/`, `screenshots/` and `dossier.json`.
