// main.ts — the driver the harness runs (node /bot/main.ts, Node 22). It reads every case from
// /input/cases.json (an array of {id, input}), answers each one with run() from solve.js, and writes the answers,
// one per case in the cases' order, to /output/answers.json. Outside a container, MAKEFUN_INPUT_DIR and
// MAKEFUN_OUTPUT_DIR stand in for /input and /output.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// V8's incremental marking off, set before solve.js is imported so all of its work runs under it (the house
// baseline runs timed with the same flag, and an entry may tune V8's flags the same way).
setFlagsFromString('--no-incremental-marking');

const { run } = (await import(new URL('./solve.js', import.meta.url).href)) as {
  run: (input: unknown) => unknown;
};

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const cases = JSON.parse(readFileSync(join(inputDir, 'cases.json'), 'utf8')) as { id: string; input: unknown }[];
const answers = cases.map((c) => run(c.input));
writeFileSync(join(outputDir, 'answers.json'), JSON.stringify(answers));
