# Solmar Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/monicazhy949/makefun-entries/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/monicazhy949/makefun-entries/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6, built for
[make.fun's gta6-01 bounty](https://make.fun/bounty/gta6-01). Explore the
sun-soaked city of Solmar Bay on foot and by car, steal rides, dodge the
police, and run nine jobs for the fixer Vera Solano. A clean full run pays
**$12,590**.

## Play

Serve `game/` with any static file server and open `game/index.html` in a
desktop browser. No build step, no network requests: every file the game
loads lives under `game/`.

```sh
node --experimental-strip-types main.ts   # also writes out/ via MAKEFUN_OUTPUT_DIR
```

Or serve the folder directly:

```sh
npx serve game
```

## Controls

- **WASD / arrows** — drive and walk (Shift runs on foot, Space is the handbrake)
- **E** — enter and exit cars
- **Mouse** — aim, **click** — shoot
- **L** — save a screenshot, **P** — pause, **Enter** — start / continue

## The city

A road grid with a taxi stand, hospital, casino, garage, warehouse, police
station, spray shop, two safehouses and the pier, with traffic and
pedestrians on the streets, the sea along the east edge, and a HUD with a
minimap, wanted stars, health and cash.

## Missions

| # | Job | Payout |
|---|-----|-------:|
| 1 | First Fare | $550 |
| 2 | Hot Wheels | $500 |
| 3 | The Drop | $700 |
| 4 | Heat Wave | $800 |
| 5 | Dockside Deal | $1,240 |
| 6 | The Big Score | $2,500 |
| 7 | Night Shift | $1,500 |
| 8 | Warehouse Raid | $1,800 |
| 9 | Street King | $3,000 |
|   | **Full run** | **$12,590** |

## Systems

- **Driving** — arcade handling, traffic that follows the roads, cars to
  steal (including the Falcon GT)
- **Wanted** — heat rises with crime, stars follow, patrol cars chase and
  ram, foot cops close in and make the bust; lay low to cool off
- **Combat** — aim and shoot on foot, rivals shoot back, kills only count
  on kill steps
- **Progression** — mission payouts, autosave after every job, continue
  from the title screen with C

## Layout

- `main.ts` — the entry program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json`
- `game/index.html` — the page; `game/src/` holds one module per system
  (`world`, `vehicles`, `pedestrians`, `player`, `combat`, `police`,
  `missions`, `game`, `render`, `hud`, `input`, `audio`, `save`, `shots`)
- `screenshots/` — four real renders of the game
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

## License

MIT. See `LICENSE`.
