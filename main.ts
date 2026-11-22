// mend: a command-line patch tool. It reads a patch in one of four formats
// (unified diff, SEARCH/REPLACE blocks, V4A, JSON edits), finds the lines each
// edit names at the first of three matching tiers, and writes every change or
// none. Node 22, standard library only; run as `node main.ts [options] [PATCH]`.
//
// In a trial the grader runs `node /bot/main.ts` with MAKEFUN_ENV_URL set, and
// this file hands over to runner.ts (the last lines below).

import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';

const FORMATS = ['auto', 'unified', 'search-replace', 'v4a', 'json'];

/** An exit-2 outcome: the single line to print. */
class Exit2 {
  readonly line: string;
  constructor(line: string) {
    this.line = line;
  }
}

/** One failed edit: its code and the path it concerns. */
class Fail {
  readonly code: string;
  readonly path: string;
  constructor(code: string, path: string) {
    this.code = code;
    this.path = path;
  }
}

const blank = (s: string): boolean => s.trim() === '';

/** A patch's lines: split at \n, one trailing \r removed, no empty piece after a final \n. */
function patchLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (text.endsWith('\n')) lines.pop();
  return lines.map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));
}

function safe(p: string): boolean {
  return p !== '' && !p.startsWith('/') && !p.includes('\\') && p.split('/').every((s) => s !== '' && s !== '.' && s !== '..');
}

/** A file as lines: its line break, its lines, whether it ends with a break. */
interface Doc {
  br: string;
  lines: string[];
  final: boolean;
}

function parseDoc(text: string): Doc {
  if (text === '') return { br: '\n', lines: [], final: false };
  const nl = text.indexOf('\n');
  const br = nl > 0 && text[nl - 1] === '\r' ? '\r\n' : '\n';
  const lines = text.split(br);
  const final = text.endsWith(br);
  if (final) lines.pop();
  return { br, lines, final };
}

function writeDoc(d: Doc): string {
  if (d.lines.length === 0) return '';
  return d.lines.join(d.br) + (d.final ? d.br : '');
}

/** The tree as the edits leave it: changed paths in `now` (null: deleted). */
class Tree {
  private readonly orig = new Map<string, string | null>();
  readonly now = new Map<string, string | null>();
  readonly moves: Array<[string, string]> = [];

  original(p: string): string | null {
    if (!this.orig.has(p)) {
      let v: string | null = null;
      try {
        if (statSync(p).isFile()) v = readFileSync(p, 'utf8');
      } catch {
        v = null;
      }
      this.orig.set(p, v);
    }
    return this.orig.get(p)!;
  }

  get(p: string): string | null {
    return this.now.has(p) ? this.now.get(p)! : this.original(p);
  }
}

type Edit = (tree: Tree) => void;

/** A line of an old or new block; ctx lines are written as the file's own matched line. */
interface RLine {
  text: string;
  ctx: boolean;
}

function norm(line: string, tier: number): string {
  if (tier === 0) return line;
  if (tier === 1) return line.replace(/[ \t]+$/, '');
  return line.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
}

/** Every position at or after `from` where O occurs in the file at one tier. */
function occurrences(O: string[], file: string[], tier: number, from = 0): number[] {
  const out: number[] = [];
  if (O.length === 0) return out;
  const on = O.map((l) => norm(l, tier));
  for (let i = from; i + O.length <= file.length; i++) {
    let ok = true;
    for (let j = 0; j < O.length; j++) {
      if (norm(file[i + j]!, tier) !== on[j]) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(i);
  }
  return out;
}

/** The first tier at which O occurs (tier 0 only when strict), with its positions. */
function findTier(O: string[], file: string[], strict: boolean, from = 0): { tier: number; occ: number[] } | null {
  const max = strict ? 0 : 2;
  for (let t = 0; t <= max; t++) {
    const occ = occurrences(O, file, t, from);
    if (occ.length > 0) return { tier: t, occ };
  }
  return null;
}

/** The first line at or after `from` equal to one line, at the first tier with one. */
function findSingle(want: string, file: string[], strict: boolean, from = 0): number | null {
  const max = strict ? 0 : 2;
  for (let t = 0; t <= max; t++) {
    const w = norm(want, t);
    for (let i = from; i < file.length; i++) {
      if (norm(file[i]!, t) === w) return i;
    }
  }
  return null;
}

/** Replace O's lines at position i with N's: context lines take the file's own lines, and at tier 2 the other lines of N are re-indented from O's first line's indent to the file's first matched line's. */
function applyAt(lines: string[], i: number, O: RLine[], N: RLine[], tier: number): string[] {
  const out = lines.slice(0, i);
  const ctxFile: string[] = [];
  O.forEach((o, k) => {
    if (o.ctx) ctxFile.push(lines[i + k]!);
  });
  let ci = 0;
  let f = '';
  let p = '';
  if (tier === 2 && O.length > 0) {
    f = /^[ \t]*/.exec(lines[i]!)![0];
    p = /^[ \t]*/.exec(O[0]!.text)![0];
  }
  for (const n of N) {
    if (n.ctx) {
      out.push(ctxFile[ci++]!);
      continue;
    }
    let t = n.text;
    if (tier === 2 && t.trim() !== '' && t.startsWith(p)) t = f + t.slice(p.length);
    out.push(t);
  }
  out.push(...lines.slice(i + O.length));
  return out;
}

/** Detect the patch format (SPEC.md section 4), or null when none matches. */
function detect(lines: string[]): string | null {
  const first = lines.findIndex((l) => !blank(l));
  if (first < 0) return null;
  if (lines[first]!.trim() === '*** Begin Patch') return 'v4a';
  const c = lines[first]!.trimStart()[0];
  if (c === '[' || c === '{') return 'json';
  if (lines.some((l) => l.trimEnd() === '<<<<<<< SEARCH')) return 'search-replace';
  if (lines.some((l, i) => l.startsWith('diff --git ') || (l.startsWith('--- ') && (lines[i + 1] ?? '').startsWith('+++ ')))) return 'unified';
  return null;
}

/** One JSON edit object (SPEC.md section 9), or null when it is not one. */
function jsonEdit(v: unknown): Edit | null {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const p = o.path;
  if (typeof p !== 'string') return null;
  const read = (tree: Tree): string => {
    if (!safe(p)) throw new Fail('unsafe', p);
    const t = tree.get(p);
    if (t === null) throw new Fail('missing', p);
    return t;
  };
  if (o.command === 'create' && typeof o.file_text === 'string') {
    const text = o.file_text;
    return (tree) => {
      if (!safe(p)) throw new Fail('unsafe', p);
      if (tree.get(p) !== null) throw new Fail('exists', p);
      tree.now.set(p, text);
    };
  }
  if (o.command === 'str_replace' && typeof o.old_str === 'string' && o.old_str !== '' && (o.new_str === undefined || typeof o.new_str === 'string')) {
    const oldStr = o.old_str;
    const newStr = (o.new_str as string | undefined) ?? '';
    return (tree) => {
      const before = read(tree);
      const nl = before.indexOf('\n');
      const crlf = nl > 0 && before[nl - 1] === '\r';
      const lf = (s: string): string => (crlf ? s.replaceAll('\r\n', '\n') : s);
      const t = lf(before);
      const old = lf(oldStr);
      let count = 0;
      for (let k = t.indexOf(old); k >= 0; k = t.indexOf(old, k + 1)) count += 1;
      if (count === 0) throw new Fail('no-match', p);
      if (count > 1) throw new Fail('ambiguous', p);
      const at = t.indexOf(old);
      const out = t.slice(0, at) + lf(newStr) + t.slice(at + old.length);
      tree.now.set(p, crlf ? out.replaceAll('\n', '\r\n') : out);
    };
  }
  if (o.command === 'insert' && typeof o.insert_line === 'number' && Number.isInteger(o.insert_line) && typeof o.new_str === 'string') {
    const line = o.insert_line;
    const add = patchLines(o.new_str);
    return (tree) => {
      const before = read(tree);
      const doc = parseDoc(before);
      if (line < 0 || line > doc.lines.length) throw new Fail('no-match', p);
      doc.lines.splice(line, 0, ...add);
      tree.now.set(p, writeDoc(doc));
    };
  }
  return null;
}

/** Read the patch as JSON: one array, or one edit object a line. */
function jsonEdits(text: string, lines: string[]): Edit[] {
  const first = lines.findIndex((l) => !blank(l));
  if (first < 0) throw new Exit2('error: parse 1');
  const edits: Edit[] = [];
  if (lines[first]!.trimStart().startsWith('[')) {
    let v: unknown;
    try {
      v = JSON.parse(text);
    } catch {
      throw new Exit2(`error: parse ${first + 1}`);
    }
    if (!Array.isArray(v)) throw new Exit2(`error: parse ${first + 1}`);
    for (const x of v) {
      const e = jsonEdit(x);
      if (e === null) throw new Exit2(`error: parse ${first + 1}`);
      edits.push(e);
    }
    return edits;
  }
  lines.forEach((l, i) => {
    if (blank(l)) return;
    let e: Edit | null = null;
    try {
      e = jsonEdit(JSON.parse(l));
    } catch {
      e = null;
    }
    if (e === null) throw new Exit2(`error: parse ${i + 1}`);
    edits.push(e);
  });
  return edits;
}

/** One unified hunk: A from its header, O and N as body lines, and whether a `\` line follows its last context or `+` line (noFinal) or its last `+` line (noFinalPlus). */
interface Hunk {
  a: number;
  o: RLine[];
  n: RLine[];
  noFinal: boolean;
  noFinalPlus: boolean;
}

interface Section {
  hdrOld: string | null;
  hdrNew: string | null;
  renOld: string | null;
  renNew: string | null;
  gitOld: string | null;
  gitNew: string | null;
  create: boolean;
  del: boolean;
  hunks: Hunk[];
}

/** The path a `--- ` or `+++ ` line names: after the four characters, up to the first tab, spaces trimmed, a leading a/ or b/ removed. */
function diffPath(l: string): string {
  let p = l.slice(4).split('\t')[0]!.trim();
  if (p.startsWith('a/') || p.startsWith('b/')) p = p.slice(2);
  return p;
}

const DIFF_RE = /^diff --git a\/(\S+) b\/(\S+)$/;
const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/** Read one hunk body starting at line j; returns the hunk and the next line index. */
function readHunk(lines: string[], a: number, j: number): { hunk: Hunk; next: number } {
  interface Body {
    kind: 'ctx' | 'old' | 'new' | 'bs';
    text: string;
    empty: boolean;
  }
  const body: Body[] = [];
  let k = j;
  while (k < lines.length) {
    const l = lines[k]!;
    if (l.startsWith('diff --git ')) break;
    if (l.startsWith('--- ') && (lines[k + 1] ?? '').startsWith('+++ ')) break;
    if (l === '') body.push({ kind: 'ctx', text: '', empty: true });
    else if (l[0] === ' ') body.push({ kind: 'ctx', text: l.slice(1), empty: false });
    else if (l[0] === '-') body.push({ kind: 'old', text: l.slice(1), empty: false });
    else if (l[0] === '+') body.push({ kind: 'new', text: l.slice(1), empty: false });
    else if (l[0] === '\\') body.push({ kind: 'bs', text: l.slice(1), empty: false });
    else break;
    k++;
  }
  while (body.length > 0 && body[body.length - 1]!.empty) body.pop();
  const o: RLine[] = [];
  const n: RLine[] = [];
  for (const b of body) {
    if (b.kind === 'ctx') {
      o.push({ text: b.text, ctx: true });
      n.push({ text: b.text, ctx: true });
    } else if (b.kind === 'old') o.push({ text: b.text, ctx: false });
    else if (b.kind === 'new') n.push({ text: b.text, ctx: false });
  }
  let noFinal = false;
  let noFinalPlus = false;
  for (let q = body.length - 1; q >= 0; q--) {
    if (body[q]!.kind === 'ctx' || body[q]!.kind === 'new') {
      noFinal = body[q + 1]?.kind === 'bs';
      break;
    }
  }
  for (let q = body.length - 1; q >= 0; q--) {
    if (body[q]!.kind === 'new') {
      noFinalPlus = body[q + 1]?.kind === 'bs';
      break;
    }
  }
  return { hunk: { a, o, n, noFinal, noFinalPlus }, next: k };
}

/** Apply one hunk to a document; d is the drift of this section's earlier hunks. */
function applyHunk(doc: Doc, h: Hunk, d: number, strict: boolean, path: string): Doc {
  if (h.o.length === 0) {
    const at = Math.min(Math.max(h.a + d, 0), doc.lines.length);
    const lines = [...doc.lines.slice(0, at), ...h.n.map((x) => x.text), ...doc.lines.slice(at)];
    return { br: doc.br, lines, final: at === doc.lines.length ? !h.noFinal : doc.final };
  }
  const found = findTier(
    h.o.map((x) => x.text),
    doc.lines,
    strict,
  );
  if (!found) throw new Fail('no-match', path);
  const target = h.a - 1 + d;
  let best = found.occ[0]!;
  for (const p of found.occ) {
    if (Math.abs(p - target) < Math.abs(best - target)) best = p;
  }
  const lines = applyAt(doc.lines, best, h.o, h.n, found.tier);
  return { br: doc.br, lines, final: best + h.o.length === doc.lines.length ? !h.noFinal : doc.final };
}

/** One unified section as an edit. */
function sectionEdit(s: Section, strict: boolean): Edit {
  const oldP = s.hdrOld ?? s.renOld ?? s.gitOld ?? '';
  const newP = s.hdrNew ?? s.renNew ?? s.gitNew ?? '';
  const isCreate = oldP === '/dev/null' || s.create;
  const isDelete = !isCreate && (newP === '/dev/null' || s.del);
  const isMove = !isCreate && !isDelete && oldP !== newP;
  return (tree) => {
    if (isCreate) {
      if (!safe(newP)) throw new Fail('unsafe', newP);
      if (tree.get(newP) !== null) throw new Fail('exists', newP);
      const added: string[] = [];
      let noFinal = false;
      let seenPlus = false;
      for (const h of s.hunks) {
        for (const x of h.n) {
          if (!x.ctx) {
            added.push(x.text);
            seenPlus = true;
            noFinal = h.noFinalPlus;
          }
        }
      }
      tree.now.set(newP, added.length === 0 ? '' : added.join('\n') + (seenPlus && noFinal ? '' : '\n'));
      return;
    }
    if (isDelete) {
      if (!safe(oldP)) throw new Fail('unsafe', oldP);
      if (tree.get(oldP) === null) throw new Fail('missing', oldP);
      tree.now.set(oldP, null);
      return;
    }
    if (!safe(oldP)) throw new Fail('unsafe', oldP);
    if (isMove && !safe(newP)) throw new Fail('unsafe', newP);
    const cur = tree.get(oldP);
    if (cur === null) throw new Fail('missing', oldP);
    if (isMove && tree.get(newP) !== null) throw new Fail('exists', newP);
    let doc = parseDoc(cur);
    let d = 0;
    for (const h of s.hunks) {
      doc = applyHunk(doc, h, d, strict, oldP);
      d += h.n.length - h.o.length;
    }
    const text = writeDoc(doc);
    if (isMove) {
      tree.now.set(newP, text);
      tree.now.set(oldP, null);
      tree.moves.push([oldP, newP]);
    } else {
      tree.now.set(oldP, text);
    }
  };
}

/** Read the patch as a unified diff (SPEC.md section 6). */
function unifiedEdits(lines: string[], strict: boolean): Edit[] {
  const sections: Section[] = [];
  let cur: Section | null = null;
  let inHeader = false;
  let i = 0;
  while (i < lines.length) {
    const l = lines[i]!;
    if (l.startsWith('diff --git ')) {
      const m = DIFF_RE.exec(l);
      if (!m) throw new Exit2(`error: parse ${i + 1}`);
      cur = { hdrOld: null, hdrNew: null, renOld: null, renNew: null, gitOld: m[1]!, gitNew: m[2]!, create: false, del: false, hunks: [] };
      sections.push(cur);
      inHeader = true;
      i++;
      continue;
    }
    if (l.startsWith('@@')) {
      const m = HUNK_RE.exec(l);
      if (!m || cur === null) throw new Exit2(`error: parse ${i + 1}`);
      const { hunk, next } = readHunk(lines, Number(m[1]), i + 1);
      cur.hunks.push(hunk);
      inHeader = false;
      i = next;
      continue;
    }
    if (cur !== null && inHeader) {
      if (l.startsWith('--- ')) {
        if (!(lines[i + 1] ?? '').startsWith('+++ ')) throw new Exit2(`error: parse ${i + 2}`);
        cur.hdrOld = diffPath(l);
        cur.hdrNew = diffPath(lines[i + 1]!);
        i += 2;
        continue;
      }
      if (l.startsWith('+++ ')) {
        cur.hdrNew = diffPath(l);
        i++;
        continue;
      }
      if (l.startsWith('rename from ')) cur.renOld = l.slice(12).trim();
      else if (l.startsWith('rename to ')) cur.renNew = l.slice(10).trim();
      else if (l.startsWith('new file mode')) cur.create = true;
      else if (l.startsWith('deleted file mode')) cur.del = true;
      i++;
      continue;
    }
    if (l.startsWith('--- ') && (lines[i + 1] ?? '').startsWith('+++ ')) {
      cur = { hdrOld: diffPath(l), hdrNew: diffPath(lines[i + 1]!), renOld: null, renNew: null, gitOld: null, gitNew: null, create: false, del: false, hunks: [] };
      sections.push(cur);
      inHeader = true;
      i += 2;
      continue;
    }
    i++;
  }
  return sections.map((s) => sectionEdit(s, strict));
}

/** One SEARCH/REPLACE block as an edit. */
function searchEdit(path: string, oldLines: string[], newLines: string[], strict: boolean): Edit {
  return (tree) => {
    if (!safe(path)) throw new Fail('unsafe', path);
    if (oldLines.length === 0) {
      if (tree.get(path) !== null) throw new Fail('exists', path);
      tree.now.set(path, newLines.length === 0 ? '' : newLines.join('\n') + '\n');
      return;
    }
    const cur = tree.get(path);
    if (cur === null) throw new Fail('missing', path);
    const doc = parseDoc(cur);
    const found = findTier(oldLines, doc.lines, strict);
    if (!found) throw new Fail('no-match', path);
    if (found.occ.length > 1) throw new Fail('ambiguous', path);
    const O = oldLines.map((t): RLine => ({ text: t, ctx: false }));
    const N = newLines.map((t): RLine => ({ text: t, ctx: false }));
    doc.lines = applyAt(doc.lines, found.occ[0]!, O, N, found.tier);
    tree.now.set(path, writeDoc(doc));
  };
}

/** Read the patch as SEARCH/REPLACE blocks (SPEC.md section 7). */
function searchEdits(lines: string[], strict: boolean): Edit[] {
  const edits: Edit[] = [];
  let prevPath: string | null = null;
  let prevEnd = 0;
  let i = 0;
  while (i < lines.length) {
    if (lines[i]!.trimEnd() !== '<<<<<<< SEARCH') {
      i++;
      continue;
    }
    const searchLine = i;
    let path: string | null = null;
    for (let j = searchLine - 1; j >= prevEnd; j--) {
      const t = lines[j]!.trim();
      if (t === '' || t.startsWith('```')) continue;
      path = t;
      break;
    }
    if (path === null) path = prevPath;
    if (path === null) throw new Exit2(`error: parse ${searchLine + 1}`);
    let sep = -1;
    let end = -1;
    for (let j = searchLine + 1; j < lines.length; j++) {
      if (lines[j]!.trimEnd() === '=======') {
        sep = j;
        break;
      }
    }
    if (sep >= 0) {
      for (let j = sep + 1; j < lines.length; j++) {
        if (lines[j]!.trimEnd() === '>>>>>>> REPLACE') {
          end = j;
          break;
        }
      }
    }
    if (sep < 0 || end < 0) throw new Exit2(`error: parse ${searchLine + 1}`);
    edits.push(searchEdit(path, lines.slice(searchLine + 1, sep), lines.slice(sep + 1, end), strict));
    prevPath = path;
    prevEnd = end + 1;
    i = end + 1;
  }
  return edits;
}

/** One V4A chunk: its anchor (null: none), O and N, and whether it is anchored to the end of the file. */
interface Chunk {
  anchor: string | null;
  o: RLine[];
  n: RLine[];
  eof: boolean;
}

/** One V4A Update File section as an edit. */
function v4aUpdate(path: string, moveTo: string | null, chunks: Chunk[], strict: boolean): Edit {
  return (tree) => {
    if (!safe(path)) throw new Fail('unsafe', path);
    if (moveTo !== null && !safe(moveTo)) throw new Fail('unsafe', moveTo);
    const cur = tree.get(path);
    if (cur === null) throw new Fail('missing', path);
    if (moveTo !== null && tree.get(moveTo) !== null) throw new Fail('exists', moveTo);
    let doc = parseDoc(cur);
    let cursor = 0;
    for (const ch of chunks) {
      if (ch.anchor !== null) {
        const at = findSingle(ch.anchor, doc.lines, strict, cursor);
        if (at === null) throw new Fail('no-match', path);
        cursor = at + 1;
      }
      if (ch.o.length === 0) {
        const at = ch.eof ? doc.lines.length : cursor;
        doc.lines = [...doc.lines.slice(0, at), ...ch.n.map((x) => x.text), ...doc.lines.slice(at)];
        cursor = at + ch.n.length;
        continue;
      }
      const oText = ch.o.map((x) => x.text);
      let hit: { tier: number; pos: number } | null = null;
      const max = strict ? 0 : 2;
      for (let t = 0; t <= max && hit === null; t++) {
        for (const p of occurrences(oText, doc.lines, t, cursor)) {
          if (ch.eof && p + oText.length !== doc.lines.length) continue;
          hit = { tier: t, pos: p };
          break;
        }
      }
      if (hit === null) throw new Fail('no-match', path);
      doc.lines = applyAt(doc.lines, hit.pos, ch.o, ch.n, hit.tier);
      cursor = hit.pos + ch.n.length;
    }
    const text = writeDoc(doc);
    if (moveTo !== null) {
      tree.now.set(moveTo, text);
      tree.now.set(path, null);
      tree.moves.push([path, moveTo]);
    } else {
      tree.now.set(path, text);
    }
  };
}

const ADD_PREFIX = '*** Add File: ';
const DEL_PREFIX = '*** Delete File: ';
const UPD_PREFIX = '*** Update File: ';
const MOVE_PREFIX = '*** Move to: ';

/** Read the patch as V4A (SPEC.md section 8). */
function v4aEdits(lines: string[], strict: boolean): Edit[] {
  const first = lines.findIndex((l) => !blank(l));
  if (first < 0) throw new Exit2('error: parse 1');
  if (lines[first]!.trim() !== '*** Begin Patch') throw new Exit2(`error: parse ${first + 1}`);
  let last = lines.length - 1;
  while (last >= 0 && blank(lines[last]!)) last--;
  if (last < 0 || lines[last]!.trim() !== '*** End Patch') throw new Exit2(`error: parse ${lines.length + 1}`);
  const edits: Edit[] = [];
  const isSectionStart = (l: string): boolean => l.startsWith(ADD_PREFIX) || l.startsWith(DEL_PREFIX) || l.startsWith(UPD_PREFIX);
  let i = first + 1;
  while (i < last) {
    const l = lines[i]!;
    if (blank(l)) {
      i++;
      continue;
    }
    if (!isSectionStart(l)) throw new Exit2(`error: parse ${i + 1}`);
    if (l.startsWith(ADD_PREFIX)) {
      const path = l.slice(ADD_PREFIX.length).trim();
      const got: Array<{ text: string; line: number; ws: boolean }> = [];
      i++;
      while (i < last && !isSectionStart(lines[i]!)) {
        const b = lines[i]!;
        if (b.startsWith('+')) got.push({ text: b.slice(1), line: i + 1, ws: false });
        else if (b === '') got.push({ text: '', line: i + 1, ws: false });
        else if (blank(b)) got.push({ text: '', line: i + 1, ws: true });
        else throw new Exit2(`error: parse ${i + 1}`);
        i++;
      }
      while (got.length > 0 && blank(lines[got[got.length - 1]!.line - 1]!)) got.pop();
      for (const g of got) {
        if (g.ws) throw new Exit2(`error: parse ${g.line}`);
      }
      const added = got.map((g) => g.text);
      edits.push((tree) => {
        if (!safe(path)) throw new Fail('unsafe', path);
        if (tree.get(path) !== null) throw new Fail('exists', path);
        tree.now.set(path, added.length === 0 ? '' : added.join('\n') + '\n');
      });
      continue;
    }
    if (l.startsWith(DEL_PREFIX)) {
      const path = l.slice(DEL_PREFIX.length).trim();
      i++;
      while (i < last && !isSectionStart(lines[i]!)) {
        if (!blank(lines[i]!)) throw new Exit2(`error: parse ${i + 1}`);
        i++;
      }
      edits.push((tree) => {
        if (!safe(path)) throw new Fail('unsafe', path);
        if (tree.get(path) === null) throw new Fail('missing', path);
        tree.now.set(path, null);
      });
      continue;
    }
    const path = l.slice(UPD_PREFIX.length).trim();
    const updLine = i + 1;
    let moveTo: string | null = null;
    const chunks: Chunk[] = [];
    let body: Array<{ kind: 'ctx' | 'old' | 'new'; text: string; raw: string }> | null = null;
    let anchor: string | null = null;
    let eof = false;
    let started = false;
    const closeChunk = (): void => {
      if (body === null) return;
      const o: RLine[] = [];
      const n: RLine[] = [];
      for (const b of body) {
        if (b.kind === 'ctx') {
          o.push({ text: b.text, ctx: true });
          n.push({ text: b.text, ctx: true });
        } else if (b.kind === 'old') o.push({ text: b.text, ctx: false });
        else n.push({ text: b.text, ctx: false });
      }
      chunks.push({ anchor, o, n, eof });
      body = null;
      anchor = null;
      eof = false;
    };
    i++;
    let firstLine = true;
    while (i < last && !isSectionStart(lines[i]!)) {
      const b = lines[i]!;
      if (firstLine && b.startsWith(MOVE_PREFIX)) {
        moveTo = b.slice(MOVE_PREFIX.length).trim();
        firstLine = false;
        i++;
        continue;
      }
      firstLine = false;
      if (b.startsWith('@@')) {
        closeChunk();
        anchor = b.slice(2).trim();
        if (anchor === '') anchor = null;
        body = [];
        started = true;
        i++;
        continue;
      }
      if (b === '*** End of File') {
        if (body === null && !started) {
          chunks.push({ anchor: null, o: [], n: [], eof: true });
          started = true;
        } else {
          eof = true;
          closeChunk();
        }
        i++;
        continue;
      }
      const isBody = b === '' || b[0] === ' ' || b[0] === '-' || b[0] === '+';
      if (isBody) {
        if (body === null) {
          if (started) throw new Exit2(`error: parse ${i + 1}`);
          body = [];
          started = true;
        }
        if (b === '') body.push({ kind: 'ctx', text: '', raw: b });
        else if (b[0] === ' ') body.push({ kind: 'ctx', text: b.slice(1), raw: b });
        else if (b[0] === '-') body.push({ kind: 'old', text: b.slice(1), raw: b });
        else body.push({ kind: 'new', text: b.slice(1), raw: b });
        i++;
        continue;
      }
      if (blank(b) && body === null) {
        i++;
        continue;
      }
      throw new Exit2(`error: parse ${i + 1}`);
    }
    if (body !== null) {
      while (body.length > 0 && blank(body[body.length - 1]!.raw)) body.pop();
      closeChunk();
    }
    if (chunks.length === 0 && moveTo === null) throw new Exit2(`error: parse ${updLine}`);
    edits.push(v4aUpdate(path, moveTo, chunks, strict));
  }
  return edits;
}

/** Run the CLI on its arguments: the exit code and the lines for standard output. */
function run(args: string[]): { code: number; out: string[] } {
  let format: string | null = null;
  let check = false;
  let strict = false;
  const pos: string[] = [];
  let ended = false;
  for (const a of args) {
    if (!ended && a === '--') ended = true;
    else if (!ended && a.startsWith('-') && a !== '-') {
      if (a.startsWith('--format=') && format === null && FORMATS.includes(a.slice(9))) format = a.slice(9);
      else if (a === '--check' && !check) check = true;
      else if (a === '--strict' && !strict) strict = true;
      else return { code: 2, out: ['error: usage'] };
    } else pos.push(a);
  }
  if (pos.length > 1) return { code: 2, out: ['error: usage'] };
  const file = pos.length === 0 || pos[0] === '-' ? null : pos[0]!;
  let text = '';
  try {
    text = readFileSync(file ?? 0, 'utf8');
  } catch {
    if (file !== null) return { code: 2, out: ['error: no-patch'] };
  }
  const lines = patchLines(text);
  const kind = format === null || format === 'auto' ? detect(lines) : format;
  if (kind === null) return { code: 2, out: ['error: format'] };
  let edits: Edit[];
  try {
    if (kind === 'json') edits = jsonEdits(text, lines);
    else if (kind === 'unified') edits = unifiedEdits(lines, strict);
    else if (kind === 'search-replace') edits = searchEdits(lines, strict);
    else edits = v4aEdits(lines, strict);
    if (edits.length === 0) throw new Exit2('error: parse 1');
  } catch (e) {
    if (e instanceof Exit2) return { code: 2, out: [e.line] };
    throw e;
  }
  const tree = new Tree();
  const fails: Fail[] = [];
  for (const edit of edits) {
    const before = new Map(tree.now);
    const movesBefore = tree.moves.length;
    try {
      edit(tree);
    } catch (e) {
      if (!(e instanceof Fail)) throw e;
      tree.now.clear();
      for (const [k, v] of before) tree.now.set(k, v);
      tree.moves.length = movesBefore;
      fails.push(e);
    }
  }
  if (fails.length > 0) {
    return { code: 1, out: [...fails.map((f) => `error: ${f.code} ${f.path}`), `failed: ${fails.length} of ${edits.length} edits`] };
  }
  if (!check) {
    for (const [p, now] of tree.now) {
      if (tree.original(p) === now) continue;
      if (now === null) rmSync(p, { force: true });
      else {
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, now);
      }
    }
  }
  const rows: Array<{ key: string; line: string }> = [];
  const replaced = new Set<string>();
  for (const [oldP, newP] of tree.moves) {
    if (tree.original(oldP) !== null && tree.get(oldP) === null && tree.original(newP) === null && tree.get(newP) !== null) {
      rows.push({ key: newP, line: `R ${oldP} -> ${newP}` });
      replaced.add(oldP);
      replaced.add(newP);
    }
  }
  for (const p of tree.now.keys()) {
    if (replaced.has(p)) continue;
    const was = tree.original(p);
    const now = tree.now.get(p)!;
    if (was === now) continue;
    rows.push({ key: p, line: `${was === null ? 'A' : now === null ? 'D' : 'M'} ${p}` });
  }
  rows.sort((a, b) => Buffer.compare(Buffer.from(a.key), Buffer.from(b.key)));
  return { code: 0, out: [...rows.map((r) => r.line), `ok: ${rows.length} ${rows.length === 1 ? 'file' : 'files'}`] };
}

const trialEnv = process.env.MAKEFUN_ENV_URL;
if (trialEnv !== undefined && trialEnv !== '') {
  // A trial: the kit's runner reads the checks from the env and runs this file on each one, without this variable.
  const { runTrial } = await import('./runner.ts');
  await runTrial(trialEnv);
} else {
  const r = run(process.argv.slice(2));
  writeSync(1, r.out.map((l) => `${l}\n`).join(''));
  process.exitCode = r.code;
}
