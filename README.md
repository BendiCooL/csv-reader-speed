# csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/BendiCooL/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/BendiCooL/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast drop-in replacement for csv-reader 1.0.0. `solve.js` exports `run(input)` and returns exactly csv-reader's answer — `{columns, rows, errors}` — for every input, including broken CSV (stray CRs, junk after a closing quote, unterminated quotes, short and long rows), under the same broken-row policy. Where the reference builds each field one character at a time and allocates a result object per field, this reader scans with `charCodeAt` and cuts each field out of the text with a single slice; only the rare field a dropped CR splits pays for piece-joining. On the kit's practice set (6 drawn cases, ~10.2M characters) its answers are identical to the reference's and its parse takes roughly a seventh of the CPU.

## Run it

```sh
MAKEFUN_INPUT_DIR=/input MAKEFUN_OUTPUT_DIR=/output node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=wg2zeety&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
