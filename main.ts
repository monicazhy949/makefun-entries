// News-image entry (Node 22, standard library only). The image beside this
// file, entry.png, is the whole entry: a front page summing up the world news
// of Saturday 21 November 2026. This program copies it to the output
// directory, byte for byte, so two runs always write the same bytes. It uses
// no network.
//
// Local run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader the output directory is /output and the entry is read from
// the file this program writes there, entry.png, nothing else.

import { copyFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
copyFileSync(new URL('./entry.png', import.meta.url), join(outDir, 'entry.png'));
