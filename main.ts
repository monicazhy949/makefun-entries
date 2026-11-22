// Tiny stack VM for make.fun's tiny-stack-vm-01-run-20261122.
// Runs every /input/<id>/ program (program.bin + input.bin) and writes
// /output/<id>/stdout.bin and /output/<id>/exit.txt. Node 22, stdlib only,
// no clock, no randomness, no network: two runs match byte for byte.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Per-opcode facts, packed as imm | pops<<3 | pushes<<6. An opcode missing
// from this table is unknown (trap 5). HALT and RET pack to 0, which is a
// real entry, not a miss: the check below is `=== undefined`.
const META: Record<number, number> = {
  0: 0, 1: 65, 2: 68, 3: 8, 4: 136, 5: 144, 6: 208, 7: 216,
  16: 80, 17: 80, 18: 80, 19: 80, 20: 80, 21: 80, 22: 80, 23: 72,
  24: 80, 25: 80, 26: 80, 27: 72, 28: 80, 29: 80, 30: 80,
  32: 80, 33: 80, 34: 80, 48: 2, 49: 10, 50: 10, 51: 2, 52: 0,
  64: 72, 65: 16, 80: 8, 81: 8, 82: 64, 83: 8,
};

// Runs one program to its end. Returns [bytes written, exit code].
// A trap ends the program at once with the trap's code as the exit code;
// whatever was written before the trap is kept.
function run(prog: Uint8Array, input: Uint8Array): [Uint8Array, number] {
  const n = prog.length;
  const st = new Int32Array(256); // data stack
  const cs = new Int32Array(64); // return addresses
  const mem = new Int32Array(256); // memory words, all zero
  const out = new Uint8Array(65536); // output bytes
  let sp = 0, cp = 0, olen = 0, ipos = 0, pc = 0, steps = 0;
  // subarray, not slice: the buffer is fresh per run and end() is called
  // once, so returning a view avoids copying up to 64 KiB per program.
  const end = (code: number): [Uint8Array, number] => [out.subarray(0, olen), code];
  for (;;) {
    if (steps === 1000000) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const op = prog[pc];
    const m = META[op];
    if (m === undefined) return end(5);
    const imm = m & 7;
    if (pc + imm >= n) return end(9);
    steps++;
    const next = pc + 1 + imm;
    const pops = (m >> 3) & 7, pushes = (m >> 6) & 7;
    if (sp < pops) return end(2);
    if (sp - pops + pushes > 256) return end(3);
    pc = next;
    switch (op) {
      case 0: return end(0);
      case 1: st[sp++] = (prog[next - 1] << 24) >> 24; break;
      case 2:
        st[sp++] = prog[next - 4] | (prog[next - 3] << 8) | (prog[next - 2] << 16) | (prog[next - 1] << 24);
        break;
      case 3: sp--; break;
      case 4: st[sp] = st[sp - 1]; sp++; break;
      case 5: { const t = st[sp - 1]; st[sp - 1] = st[sp - 2]; st[sp - 2] = t; break; }
      case 6: st[sp] = st[sp - 2]; sp++; break;
      case 7: { const t = st[sp - 3]; st[sp - 3] = st[sp - 2]; st[sp - 2] = st[sp - 1]; st[sp - 1] = t; break; }
      case 23: st[sp - 1] = -st[sp - 1] | 0; break;
      case 27: st[sp - 1] = ~st[sp - 1]; break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22:
      case 24: case 25: case 26: case 28: case 29: case 30:
      case 32: case 33: case 34: {
        const b = st[sp - 1], a = st[sp - 2];
        let r: number;
        if (op === 16) r = (a + b) | 0;
        else if (op === 17) r = (a - b) | 0;
        else if (op === 18) r = Math.imul(a, b);
        else if (op === 19) { if (b === 0) return end(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
        else if (op === 20) { if (b === 0) return end(4); r = b === -1 ? 0 : (a % b) | 0; }
        else if (op === 21) { if (b === 0) return end(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 22) { if (b === 0) return end(4); r = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (op === 24) r = a & b;
        else if (op === 25) r = a | b;
        else if (op === 26) r = a ^ b;
        else if (op === 28) r = a << (b & 31);
        else if (op === 29) r = a >> (b & 31);
        else if (op === 30) r = (a >>> (b & 31)) | 0;
        else if (op === 32) r = a === b ? 1 : 0;
        else if (op === 33) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        sp -= 2;
        st[sp++] = r;
        break;
      }
      case 48: case 49: case 50: {
        const rel = ((prog[next - 2] | (prog[next - 1] << 8)) << 16) >> 16;
        let take = true;
        if (op !== 48) { const v = st[--sp]; take = op === 49 ? v === 0 : v !== 0; }
        if (take) pc = next + rel;
        break;
      }
      case 51:
        if (cp === 64) return end(7);
        cs[cp++] = next;
        pc = prog[next - 2] | (prog[next - 1] << 8);
        break;
      case 52:
        if (cp === 0) return end(8);
        pc = cs[--cp];
        break;
      case 64: {
        const addr = st[sp - 1];
        if (addr < 0 || addr >= 256) return end(6);
        st[sp - 1] = mem[addr];
        break;
      }
      case 65: {
        const addr = st[sp - 1], v = st[sp - 2];
        if (addr < 0 || addr >= 256) return end(6);
        sp -= 2;
        mem[addr] = v;
        break;
      }
      case 80: {
        const s = String(st[sp - 1]);
        if (olen + s.length > 65536) return end(11);
        sp--;
        for (let i = 0; i < s.length; i++) out[olen++] = s.charCodeAt(i);
        break;
      }
      case 81:
        if (olen + 1 > 65536) return end(11);
        out[olen++] = st[--sp] & 255;
        break;
      case 82:
        st[sp++] = ipos < input.length ? input[ipos++] : -1;
        break;
      case 83:
        return end(st[--sp] & 255);
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  try {
    // readFileSync already returns a Buffer, which is a Uint8Array: pass it
    // straight to run() instead of copying the program and input bytes.
    const [bytes, code] = run(
      readFileSync(join(I, id, 'program.bin')),
      readFileSync(join(I, id, 'input.bin')),
    );
    mkdirSync(join(O, id), { recursive: true });
    writeFileSync(join(O, id, 'stdout.bin'), bytes);
    writeFileSync(join(O, id, 'exit.txt'), `${code}\n`);
  } catch {
    // One bad instance must not kill the whole set: answer it empty.
    try {
      mkdirSync(join(O, id), { recursive: true });
      writeFileSync(join(O, id, 'stdout.bin'), '');
      writeFileSync(join(O, id, 'exit.txt'), '9\n');
    } catch { /* nothing left to try */ }
  }
}
