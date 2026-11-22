# makefun-entries

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/monicazhy949/makefun-entries/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/monicazhy949/makefun-entries/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar: a market-calibrated token launch radar. It reads the sealed DefiLlama snapshot, ranks all 40 watchlist protocols plus 138 early pre-token protocols by an implied value calibrated from the snapshot's own live-token protocols (the median market-cap/TVL the market pays live ones), and gives each protocol a concrete farm plan with costs and times. The dashboard is a static page: a sortable, filterable board, a detail view per protocol with the model's own inputs, and the live-token set kept apart.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
