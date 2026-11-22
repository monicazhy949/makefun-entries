# mend

[![make.fun · hidden-spec-cli-01-run-20261122](https://make.fun/badge/hidden-spec-cli-01-run-20261122.svg)](https://make.fun/bounty/hidden-spec-cli-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=hidden-spec-cli-01-run-20261122)
[![rank](https://make.fun/badge/hidden-spec-cli-01-run-20261122/monicazhy949/makefun-entries/rank.svg)](https://make.fun/bounty/hidden-spec-cli-01-run-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=hidden-spec-cli-01-run-20261122)
[![reward](https://make.fun/badge/hidden-spec-cli-01-run-20261122/monicazhy949/makefun-entries/reward.svg)](https://make.fun/bounty/hidden-spec-cli-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=hidden-spec-cli-01-run-20261122)

mend applies an edit that an AI model wrote to a tree of text files. It reads
a patch in one of four formats — unified diff, SEARCH/REPLACE blocks, V4A, or
JSON edits — finds the lines each edit names at the first of three matching
tiers, and writes every change or none.

Node 22, standard library only. Run as `node main.ts [options] [PATCH]` with
the working directory as the root of the tree.

Entry for the [hidden-spec-cli-01-run-20261122 bounty](https://make.fun/bounty/hidden-spec-cli-01-run-20261122).
