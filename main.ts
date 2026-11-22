// A Sokoban solver: push-optimal A* per room.
//
// A level is a hallway with rooms off it, and a box never leaves its room, so
// each room is a problem of its own and the push counts add up to the level's
// optimum. Inside a room the search runs over pushes, not steps: a state is the
// boxes' squares plus the player's reachable region, and the estimate is the
// cheapest assignment of boxes to goals under exact single-box push distances,
// which never overestimates, so the first solution found is push-optimal. Dead
// squares (no push from them reaches a goal) and frozen 2x2 blocks are pruned.
// Everything is budgeted by work, never by the clock, and every tie breaks the
// same way on every run, so two runs of the program agree byte for byte.
//
// Local run: mkdir -p out && MAKEFUN_INPUT_DIR=practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// [dx, dy, step letter, push letter]; this order is the tie-break everywhere.
const DIRS = [
  [0, -1, 'u', 'U'],
  [0, 1, 'd', 'D'],
  [-1, 0, 'l', 'L'],
  [1, 0, 'r', 'R'],
];

// Work budgets, counted in expanded states, never in time. The whole set must
// finish inside one 60 second wall; a room's search is small, and the shared
// budget keeps the total bounded whatever the set holds.
const ROOM_BUDGET = 200000;
const TOTAL_BUDGET = 2000000;
let spent = 0;

const INF = 1 << 30;

/** An XSB level: width, height, walls (1 a wall; the outer frame is wall), goals, boxes, player. */
function parseLevel(text) {
  const rows = text.split('\n').filter((r) => r.length > 0);
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const wall = new Uint8Array(w * h).fill(1);
  const goals = [];
  const boxes = [];
  let player = -1;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const i = y * w + x;
      if (ch === '#') continue;
      wall[i] = 0;
      if (ch === '.' || ch === '*' || ch === '+') goals.push(i);
      if (ch === '$' || ch === '*') boxes.push(i);
      if (ch === '@' || ch === '+') player = i;
    }
  });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) wall[y * w + x] = 1;
    }
  }
  boxes.sort((a, b) => a - b);
  goals.sort((a, b) => a - b);
  return { w, h, wall, goals, boxes, player };
}

/** The squares from which a box alone can be pushed onto some goal, pulled back from the goals over open floor. */
function liveSquares(w, wall, goals) {
  const live = new Uint8Array(wall.length);
  const queue = [...goals];
  for (const g of goals) live[g] = 1;
  for (let qi = 0; qi < queue.length; qi++) {
    const x = queue[qi];
    for (const [dx, dy] of DIRS) {
      const d = dy * w + dx;
      const y = x - d;
      // A box on y reaches x by one push only when the player can stand on y - d.
      if (y >= 0 && y < wall.length && !wall[y] && y - d >= 0 && y - d < wall.length && !wall[y - d] && !live[y]) {
        live[y] = 1;
        queue.push(y);
      }
    }
  }
  return live;
}

/**
 * Exact single-box push distances to one goal: dist[b] is the fewest pushes that
 * bring a box from square b onto the goal, the room otherwise empty, or INF.
 * Nodes are (box, player) pairs with the player beside the box; walking around
 * the box costs nothing, a push costs one. Solved backwards from the goal with a
 * 0-1 BFS, so the table is exact.
 */
function pushDistances(w, wall, goal) {
  const size = wall.length;
  const dist = new Int32Array(size).fill(INF);
  dist[goal] = 0;
  const nodeDist = new Map();
  const queue = [];
  const nodeKey = (b, p) => b * size + p;
  const adjacent = (b) => {
    const out = [];
    for (const [dx, dy] of DIRS) {
      const q = b + dy * w + dx;
      if (q >= 0 && q < size && !wall[q]) out.push(q);
    }
    return out;
  };
  for (const p of adjacent(goal)) {
    nodeDist.set(nodeKey(goal, p), 0);
    queue.push([goal, p]);
  }
  // 0-1 BFS: walk edges cost 0 (to the front), push edges cost 1 (to the back).
  const seenWalk = new Int32Array(size);
  let walkStamp = 0;
  while (queue.length > 0) {
    const [b, p] = queue.shift();
    const c = nodeDist.get(nodeKey(b, p));
    // Walk around the box for free: every square beside it the player can reach
    // without crossing the box joins this node at the same cost.
    const stamp = ++walkStamp;
    const stack = [p];
    seenWalk[p] = stamp;
    while (stack.length > 0) {
      const q = stack.pop();
      for (const [dx, dy] of DIRS) {
        const r = q + dy * w + dx;
        if (r >= 0 && r < size && !wall[r] && r !== b && seenWalk[r] !== stamp) {
          seenWalk[r] = stamp;
          stack.push(r);
        }
      }
    }
    for (const p2 of adjacent(b)) {
      if (p2 !== p && seenWalk[p2] === stamp) {
        const k = nodeKey(b, p2);
        if (!nodeDist.has(k)) {
          nodeDist.set(k, c);
          queue.unshift([b, p2]);
        }
      }
    }
    // Reverse a push: this node follows a push in direction d when the player
    // stands where the push ended, p = b - d; before it the box was on b - d
    // and the player on b - 2d.
    for (const [dx, dy] of DIRS) {
      const d = dy * w + dx;
      if (p !== b - d) continue;
      const b2 = b - d;
      const p2 = b - 2 * d;
      if (b2 < 0 || b2 >= size || p2 < 0 || p2 >= size || wall[b2] || wall[p2]) continue;
      const k = nodeKey(b2, p2);
      if (!nodeDist.has(k)) {
        nodeDist.set(k, c + 1);
        queue.push([b2, p2]);
      }
    }
  }
  for (const [k, c] of nodeDist) {
    const b = Math.floor(k / size);
    if (c < dist[b]) dist[b] = c;
  }
  return dist;
}

/**
 * The level's rooms: cut the dead squares of the player's row (the hallway: a
 * box there reaches no goal) out of the floor, and each part left that holds a
 * box is a room. Null when some part holds more or fewer boxes than goals, or a
 * box starts in the hallway: then the level is no set of rooms.
 */
function roomsOf(level, live) {
  const { w, wall, goals, boxes, player } = level;
  const row = Math.floor(player / w);
  const cut = new Uint8Array(wall.length);
  for (let i = row * w; i < (row + 1) * w; i++) {
    if (!wall[i] && !live[i]) cut[i] = 1;
  }
  if (boxes.some((b) => cut[b])) return null;
  const part = new Int32Array(wall.length).fill(-1);
  const rooms = [];
  for (let s = 0; s < wall.length; s++) {
    if (wall[s] || cut[s] || part[s] >= 0) continue;
    const squares = [s];
    part[s] = rooms.length;
    for (let i = 0; i < squares.length; i++) {
      for (const [dx, dy] of DIRS) {
        const q = squares[i] + dy * w + dx;
        if (q >= 0 && q < wall.length && !wall[q] && !cut[q] && part[q] < 0) {
          part[q] = rooms.length;
          squares.push(q);
        }
      }
    }
    rooms.push({ squares, boxes: [], goals: [], done: false });
  }
  for (const b of boxes) {
    if (part[b] < 0) return null;
    rooms[part[b]].boxes.push(b);
  }
  for (const g of goals) {
    if (part[g] < 0) return null;
    rooms[part[g]].goals.push(g);
  }
  if (rooms.some((r) => r.boxes.length !== r.goals.length)) return null;
  return rooms.filter((r) => r.boxes.length > 0);
}

/**
 * Push search over one room (or a whole level): { pushes, moves }, or null when
 * the budget runs out. mode is 'astar' (optimal), 'bfs' (optimal, no estimate),
 * 'weighted' (fast, usually near-optimal) or 'greedy' (fast, any solution).
 * A state is the boxes' squares plus the player's reachable region, named by its
 * lowest square; the estimate is the cheapest assignment of boxes to goals under
 * the exact single-box push distances, which never overestimates.
 */
function searchRoom(sub, live, tables, mode, budget) {
  const { w, wall, goals, boxes: startBoxes, player: startPlayer } = sub;
  const size = wall.length;
  const goalSet = new Uint8Array(size);
  for (const g of goals) goalSet[g] = 1;
  const isBfs = mode === 'bfs';
  const isGreedy = mode === 'greedy';
  const weight = mode === 'weighted' ? 3 : 1;

  // The states, in the order found: boxes, the player's square, parent, the push
  // that made them, pushes so far, and the region's lowest square.
  const sBoxes = [startBoxes.slice()];
  const sPlayer = [startPlayer];
  const sParent = [-1];
  const sPushFrom = [-1];
  const sPushTo = [-1];
  const sG = [0];
  const sLow = [0];

  const occupied = new Uint8Array(size);
  const seenA = new Int32Array(size);
  const seenB = new Int32Array(size);
  const stack = new Int32Array(size);
  let stampA = 0;
  let stampB = 0;

  // The player's reachable region from `from`, boxes as obstacles, marked in
  // `seen` with `stamp`; returns its lowest square.
  function flood(from, seen, stamp) {
    let low = from;
    let top = 0;
    stack[top++] = from;
    seen[from] = stamp;
    while (top > 0) {
      const p = stack[--top];
      if (p < low) low = p;
      const q0 = p - w;
      const q1 = p + w;
      const q2 = p - 1;
      const q3 = p + 1;
      if (!wall[q0] && !occupied[q0] && seen[q0] !== stamp) {
        seen[q0] = stamp;
        stack[top++] = q0;
      }
      if (!wall[q1] && !occupied[q1] && seen[q1] !== stamp) {
        seen[q1] = stamp;
        stack[top++] = q1;
      }
      if (!wall[q2] && !occupied[q2] && seen[q2] !== stamp) {
        seen[q2] = stamp;
        stack[top++] = q2;
      }
      if (!wall[q3] && !occupied[q3] && seen[q3] !== stamp) {
        seen[q3] = stamp;
        stack[top++] = q3;
      }
    }
    return low;
  }

  // Whether the box just pushed to `t` sits in a frozen 2x2 block of walls and
  // boxes with a box off its goal: no box of such a block ever moves again.
  function frozenBlock(t) {
    for (const a of [t, t - 1, t - w, t - w - 1]) {
      const b = a + 1;
      const c = a + w;
      const d = c + 1;
      if (a < 0 || d >= size) continue;
      if (!(wall[a] || occupied[a]) || !(wall[b] || occupied[b]) || !(wall[c] || occupied[c]) || !(wall[d] || occupied[d])) {
        continue;
      }
      if ((occupied[a] && !goalSet[a]) || (occupied[b] && !goalSet[b]) || (occupied[c] && !goalSet[c]) || (occupied[d] && !goalSet[d])) {
        return true;
      }
    }
    return false;
  }

  // The estimate: the cheapest assignment of boxes to goals under the exact
  // single-box push distances (few boxes), or the sum of each box's nearest goal
  // (many boxes). Both never overestimate: every push moves one box one square.
  function heuristic(boxes) {
    const n = boxes.length;
    if (n <= 5) {
      let best = INF;
      const used = new Array(n).fill(false);
      const rec = (i, sum) => {
        if (sum >= best) return;
        if (i === n) {
          best = sum;
          return;
        }
        for (let j = 0; j < n; j++) {
          if (used[j]) continue;
          const d = tables[j][boxes[i]];
          if (d >= INF) continue;
          used[j] = true;
          rec(i + 1, sum + d);
          used[j] = false;
        }
      };
      rec(0, 0);
      return best;
    }
    let sum = 0;
    for (const b of boxes) {
      let m = INF;
      for (let j = 0; j < n; j++) if (tables[j][b] < m) m = tables[j][b];
      if (m >= INF) return INF;
      sum += m;
    }
    return sum;
  }

  // A heap on [f, g, sequence, state]: f first; then, except in BFS, the deeper
  // state; then the order found. Every tie breaks the same way on every run.
  const heap = [];
  const less = (a, b) => {
    if (a[0] !== b[0]) return a[0] < b[0];
    if (!isBfs && a[1] !== b[1]) return a[1] > b[1];
    return a[2] < b[2];
  };
  const heapPush = (e) => {
    let i = heap.length;
    heap.push(e);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(heap[i], heap[p])) break;
      const t = heap[i];
      heap[i] = heap[p];
      heap[p] = t;
      i = p;
    }
  };
  const heapPop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= heap.length) break;
        if (c + 1 < heap.length && less(heap[c + 1], heap[c])) c++;
        if (!less(heap[c], heap[i])) break;
        const t = heap[i];
        heap[i] = heap[c];
        heap[c] = t;
        i = c;
      }
    }
    return top;
  };

  const keyOf = (boxes, low) => low + '|' + boxes.join(',');
  const best = new Map();
  let seq = 0;
  const score = (g, h) => (isGreedy ? h : g + weight * h);

  for (const b of startBoxes) occupied[b] = 1;
  sLow[0] = flood(startPlayer, seenA, ++stampA);
  for (const b of startBoxes) occupied[b] = 0;
  const h0 = heuristic(startBoxes);
  if (h0 >= INF) return null;
  best.set(keyOf(startBoxes, sLow[0]), 0);
  heapPush([score(0, h0), 0, seq++, 0]);

  let expanded = 0;
  while (heap.length > 0) {
    const [, g, , s] = heapPop();
    const boxes = sBoxes[s];
    if (best.get(keyOf(boxes, sLow[s])) < g) continue;
    if (boxes.every((b) => goalSet[b])) return reconstruct(s);
    if (expanded >= budget || spent >= TOTAL_BUDGET) return null;
    expanded++;
    spent++;
    for (const b of boxes) occupied[b] = 1;
    const here = ++stampA;
    flood(sPlayer[s], seenA, here);
    for (let bi = 0; bi < boxes.length; bi++) {
      const b = boxes[bi];
      for (const [dx, dy] of DIRS) {
        const d = dy * w + dx;
        const behind = b - d;
        const target = b + d;
        if (seenA[behind] !== here || wall[target] || occupied[target] || !live[target]) continue;
        occupied[b] = 0;
        occupied[target] = 1;
        if (frozenBlock(target)) {
          occupied[target] = 0;
          occupied[b] = 1;
          continue;
        }
        const next = boxes.slice();
        next[bi] = target;
        next.sort((x, y) => x - y);
        const low = flood(b, seenB, ++stampB);
        const k = keyOf(next, low);
        const g2 = g + 1;
        const prev = best.get(k);
        if (prev !== undefined && prev <= g2) {
          occupied[target] = 0;
          occupied[b] = 1;
          continue;
        }
        const h2 = heuristic(next);
        if (h2 >= INF) {
          occupied[target] = 0;
          occupied[b] = 1;
          continue;
        }
        best.set(k, g2);
        const t = sBoxes.length;
        sBoxes.push(next);
        sPlayer.push(b);
        sParent.push(s);
        sPushFrom.push(b);
        sPushTo.push(target);
        sG.push(g2);
        sLow.push(low);
        heapPush([score(g2, h2), g2, seq++, t]);
        occupied[target] = 0;
        occupied[b] = 1;
      }
    }
    for (const b of boxes) occupied[b] = 0;
  }
  return null;

  // The moves for a solved state: walk to each push's square, then push.
  function reconstruct(s) {
    const path = [];
    for (let t = s; t > 0; t = sParent[t]) path.push(t);
    path.reverse();
    let moves = '';
    let player = startPlayer;
    let boxes = startBoxes.slice();
    for (const t of path) {
      const from = sPushFrom[t];
      const to = sPushTo[t];
      const d = to - from;
      for (const b of boxes) occupied[b] = 1;
      const walk = walkTo(player, from - d);
      for (const b of boxes) occupied[b] = 0;
      if (walk === null) return null;
      moves += walk;
      const dir = DIRS.find(([dx, dy]) => dy * w + dx === d);
      moves += dir[3];
      player = from;
      boxes = boxes.map((b) => (b === from ? to : b)).sort((x, y) => x - y);
    }
    return { pushes: path.length, moves };
  }

  // The shortest walk from `from` to `to` around walls and boxes, in lower LURD
  // letters (the first direction first on ties), or null when unreachable.
  function walkTo(from, to) {
    if (from === to) return '';
    const prev = new Int32Array(size).fill(-1);
    const how = new Array(size);
    const queue = [from];
    prev[from] = from;
    for (let qi = 0; qi < queue.length; qi++) {
      const p = queue[qi];
      if (p === to) break;
      for (const [dx, dy, letter] of DIRS) {
        const q = p + dy * w + dx;
        if (q < 0 || q >= size || wall[q] || occupied[q] || prev[q] !== -1) continue;
        prev[q] = p;
        how[q] = letter;
        queue.push(q);
      }
    }
    if (prev[to] === -1) return null;
    let out = '';
    for (let p = to; p !== from; p = prev[p]) out = how[p] + out;
    return out;
  }
}

/** A room solved: optimal A* first, then BFS, then faster searches that may cost a push or two. */
function solveRoom(sub, live) {
  const tables = sub.goals.map((g) => pushDistances(sub.w, sub.wall, g));
  for (const mode of ['astar', 'bfs', 'weighted', 'greedy']) {
    const solved = searchRoom(sub, live, tables, mode, ROOM_BUDGET);
    if (solved !== null) return solved;
    if (spent >= TOTAL_BUDGET) break;
  }
  return null;
}

/** The square the player stands on after `moves` from `from` on a board `w` wide. */
function endOf(w, from, moves) {
  let p = from;
  for (const ch of moves.toLowerCase()) p += ch === 'u' ? -w : ch === 'd' ? w : ch === 'l' ? -1 : 1;
  return p;
}

/** The moves for a level in XSB: each room solved in turn, the other rooms' boxes standing as walls. */
function solve(text) {
  const level = parseLevel(text);
  const live = liveSquares(level.w, level.wall, level.goals);
  if (level.boxes.some((b) => !live[b])) return '';
  const rooms = roomsOf(level, live);
  if (rooms === null) {
    const solved = solveRoom(
      { w: level.w, h: level.h, wall: level.wall, goals: level.goals, boxes: level.boxes, player: level.player },
      live,
    );
    return solved === null ? '' : solved.moves;
  }
  let player = level.player;
  let moves = '';
  for (const room of rooms) {
    const wall = level.wall.slice();
    for (const other of rooms) {
      if (other === room) continue;
      for (const b of other.done ? other.goals : other.boxes) wall[b] = 1;
    }
    const sub = {
      w: level.w,
      h: level.h,
      wall,
      goals: room.goals.slice().sort((a, b) => a - b),
      boxes: room.boxes.slice().sort((a, b) => a - b),
      player,
    };
    const subLive = liveSquares(sub.w, sub.wall, sub.goals);
    const solved = solveRoom(sub, subLive);
    if (solved === null) return '';
    moves += solved.moves;
    player = endOf(level.w, player, solved.moves);
    room.done = true;
  }
  return moves;
}

for (const id of readdirSync(INPUT).sort()) {
  const moves = solve(readFileSync(join(INPUT, id, 'level.txt'), 'utf8'));
  mkdirSync(join(OUTPUT, id), { recursive: true });
  writeFileSync(join(OUTPUT, id, 'solution.txt'), `${moves}\n`);
}
