// news-image-20261122 entry (Node 22, standard library only): the front page
// summing up Sunday 22 November 2026's world news lives in entry.png beside
// this file; the program writes those exact bytes to /output/entry.png
// (MAKEFUN_OUTPUT_DIR stands in for /output outside the grader). A pure copy,
// so both runs produce identical bytes.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const image = readFileSync(join(here, "entry.png"));
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "entry.png"), image);
