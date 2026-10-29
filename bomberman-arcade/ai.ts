// ai.ts — how enemies and CPU bombers decide where to go, and how human
// players' buttons turn into moves.

// ---------------------------------------------------------------- human input
function pollCtrl(c: Ctrl): Input {
    const pad = c.pad == 2 ? controller.player2 : controller.player1
    const down = [pad.up.isPressed(), pad.right.isPressed(), pad.down.isPressed(), pad.left.isPressed()]
    // remember the order directions were pressed: the newest one wins,
    // so you can hold right and tap up to turn a corner
    for (let i = 0; i < 4; i++) {
        const at = c.held.indexOf(i)
        if (down[i] && at < 0) c.held.push(i)
        else if (!down[i] && at >= 0) c.held.removeAt(at)
    }
    const out = new Input()
    out.held = c.held.slice(0)
    out.bomb = c.bombTap
    out.det = c.detTap
    c.bombTap = false
    c.detTap = false
    return out
}

// ---------------------------------------------------------------- breadth-first search
// BFS explores the map in rings of growing distance, so the first goal it reaches
// is the closest one. These arrays are allocated once and reused to save memory.
const MAX_CELLS = 31 * 13
const bfsDist: number[] = []
const bfsPrev: number[] = []
const bfsQueue: number[] = []
for (let i = 0; i < MAX_CELLS; i++) { bfsDist.push(-1); bfsPrev.push(-1); bfsQueue.push(0) }

function shuffledDirs(): number[] {
    return shuffle([0, 1, 2, 3])
}

// returns the first direction to step in toward the nearest cell where goal() is true, or -1
function bfsDir(sx: number, sy: number,
    pass: (nx: number, ny: number, j: number, d: number) => boolean,
    goal: (i: number, d: number) => boolean, maxD: number): number {
    const n = mapW * mapH
    for (let i = 0; i < n; i++) { bfsDist[i] = -1; bfsPrev[i] = -1 }
    const s = I(sx, sy)
    bfsDist[s] = 0
    let head = 0, tail = 0
    bfsQueue[tail++] = s
    const order = shuffledDirs()
    while (head < tail) {
        const i = bfsQueue[head++]
        if (i != s && goal(i, bfsDist[i])) return firstDir(s, i)
        if (bfsDist[i] >= maxD) continue
        const x = i % mapW, y = Math.idiv(i, mapW)
        for (const d of order) {
            const nx = x + DX[d], ny = y + DY[d]
            if (!inb(nx, ny)) continue
            const j = I(nx, ny)
            if (bfsDist[j] >= 0 || !pass(nx, ny, j, bfsDist[i] + 1)) continue
            bfsDist[j] = bfsDist[i] + 1
            bfsPrev[j] = i
            bfsQueue[tail++] = j
        }
    }
    return -1
}

// walk the breadcrumbs back from the target to find the first step
function firstDir(s: number, t: number): number {
    let c = t
    while (bfsPrev[c] != s) {
        c = bfsPrev[c]
        if (c < 0) return -1
    }
    const sx = s % mapW, sy = Math.idiv(s, mapW), cx = c % mapW, cy = Math.idiv(c, mapW)
    for (let d = 0; d < 4; d++) if (sx + DX[d] == cx && sy + DY[d] == cy) return d
    return -1
}

// ---------------------------------------------------------------- enemies
function enemyCan(e: Enemy, x: number, y: number): boolean {
    if (!inb(x, y)) return false
    const g = grid[I(x, y)]
    if (g == CELL_HARD) return false
    if (g >= CELL_BRICK && !EN_WALL[e.type]) return false
    if (bombAt(x, y)) return false
    return true
}

function nearestPlayer(x: number, y: number): Player {
    let best: Player = null
    let bd = 99999
    for (const p of players) if (p.alive) {
        const d = Math.abs(p.x - x) + Math.abs(p.y - y)
        if (d < bd) { bd = d; best = p }
    }
    return best
}

function chooseEnemyDir(e: Enemy) {
    const x = e.x, y = e.y
    const opts: number[] = []
    for (let d = 0; d < 4; d++) if (enemyCan(e, x + DX[d], y + DY[d])) opts.push(d)
    if (!opts.length) { e.dir = -1; return }
    const ai = EN_AI[e.type]
    const p = nearestPlayer(x, y)
    if (p) {
        const px = Math.round(p.x), py = Math.round(p.y)
        const md = Math.abs(px - x) + Math.abs(py - y)
        // smart enemies path-find straight to you
        if (ai == AI_SMART && md < 22 && Math.random() < 0.85) {
            const t = I(px, py)
            const d = bfsDir(x, y, (nx, ny, j, dd) => enemyCan(e, nx, ny), (i, dd) => i == t, 26)
            if (d >= 0) { e.dir = d; return }
        }
        // chasers just turn toward you when you are close
        if (ai == AI_CHASE && md < 9 && Math.random() < EN_CHASE[e.type]) {
            let best = opts[0], bd = 99999
            for (const d of opts) {
                const dd = Math.abs(px - (x + DX[d])) + Math.abs(py - (y + DY[d]))
                if (dd < bd) { bd = dd; best = d }
            }
            e.dir = best
            return
        }
    }
    // wander: usually keep going, rarely turn back
    if (e.dir >= 0 && opts.indexOf(e.dir) >= 0 && Math.random() < 0.78) return
    const rev = (e.dir + 2) % 4
    const pool: number[] = []
    for (const d of opts) if (opts.length == 1 || d != rev) pool.push(d)
    e.dir = pool[Math.floor(Math.random() * pool.length)]
}

function updateEnemy(e: Enemy, dt: number) {
    if (!e.alive) { e.dying -= dt; return }
    if (e.inv > 0) e.inv -= dt
    const move = EN_SPEED[e.type] * dt * (hurry ? 1.15 : 1)
    if (e.x == e.tx && e.y == e.ty) {
        chooseEnemyDir(e)
        if (e.dir < 0) return
        e.tx = e.x + DX[e.dir]
        e.ty = e.y + DY[e.dir]
    } else if (!enemyCan(e, e.tx, e.ty)) {
        // a bomb appeared in front of us: turn around
        e.tx -= DX[e.dir]; e.ty -= DY[e.dir]
        e.dir = (e.dir + 2) % 4
    }
    const dx = e.tx - e.x, dy = e.ty - e.y
    if (Math.abs(dx) + Math.abs(dy) <= move) { e.x = e.tx; e.y = e.ty }
    else { e.x += sgn(dx) * move; e.y += sgn(dy) * move }
}

// ---------------------------------------------------------------- CPU bombers (battle)
const NEVER = 999
const dangerA: number[] = []
const dangerB: number[] = []
for (let i = 0; i < MAX_CELLS; i++) { dangerA.push(NEVER); dangerB.push(NEVER) }

function blastTiles(bx: number, by: number, range: number, cb: (x: number, y: number) => void) {
    cb(bx, by)
    for (let d = 0; d < 4; d++) {
        for (let s = 1; s <= range; s++) {
            const x = bx + DX[d] * s, y = by + DY[d] * s
            if (!inb(x, y)) break
            const g = grid[I(x, y)]
            if (g == CELL_HARD) break
            cb(x, y)
            if (g >= CELL_BRICK || bombAt(x, y)) break
        }
    }
}

class Threat {
    constructor(public x: number, public y: number, public r: number, public t: number) { }
}

// danger map: for every cell, how many seconds until a flame is there (NEVER if safe).
// `extra` lets the AI ask "what if I dropped a bomb here?"
function dangerMap(out: number[], extra: Threat): number[] {
    const n = mapW * mapH
    for (let i = 0; i < n; i++) out[i] = fire[i] > 0 ? 0 : NEVER
    const list: Threat[] = []
    for (const b of bombs) list.push(new Threat(Math.round(b.x), Math.round(b.y), b.range, b.remote ? 9 : b.fuse))
    if (extra) list.push(extra)
    // bombs caught in another bomb's blast go off at the same moment
    for (let pass = 0; pass < 3; pass++)
        for (const a of list) blastTiles(a.x, a.y, a.r, (x, y) => {
            for (const b of list) if (b != a && b.x == x && b.y == y && b.t > a.t) b.t = a.t
        })
    for (const a of list) blastTiles(a.x, a.y, a.r, (x, y) => {
        const i = I(x, y)
        if (a.t < out[i]) out[i] = a.t
    })
    return out
}

function walkableFor(p: Player, x: number, y: number): boolean {
    if (!inb(x, y)) return false
    const g = grid[I(x, y)]
    if (g == CELL_HARD || (g >= CELL_BRICK && !p.wallpass)) return false
    return !bombAt(x, y)
}

function adjSoft(x: number, y: number): boolean {
    for (let d = 0; d < 4; d++) if (inb(x + DX[d], y + DY[d]) && grid[I(x + DX[d], y + DY[d])] == CELL_BRICK) return true
    return false
}

function clearLine(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = sgn(x1 - x0), dy = sgn(y1 - y0)
    let x = x0 + dx, y = y0 + dy
    while (x != x1 || y != y1) {
        if (grid[I(x, y)] != CELL_FLOOR) return false
        x += dx; y += dy
    }
    return true
}

function wantsBomb(p: Player, cx: number, cy: number): boolean {
    if (adjSoft(cx, cy)) return true
    for (const o of players) {
        if (o == p || !o.alive) continue
        const ox = Math.round(o.x), oy = Math.round(o.y)
        const lined = (ox == cx && Math.abs(oy - cy) <= p.range) || (oy == cy && Math.abs(ox - cx) <= p.range)
        if (lined && clearLine(cx, cy, ox, oy)) return Math.random() < 0.75
    }
    return false
}

// pick the most attractive safe cell: power-ups first, then bricks to blow up, then rivals
function aiGoal(p: Player, cx: number, cy: number, dmap: number[]): number {
    const n = mapW * mapH
    for (let i = 0; i < n; i++) { bfsDist[i] = -1; bfsPrev[i] = -1 }
    const s = I(cx, cy)
    bfsDist[s] = 0
    let head = 0, tail = 0, best = -1, bestScore = 999999
    bfsQueue[tail++] = s
    const hasBombs = p.active < p.maxBombs
    const order = shuffledDirs()
    while (head < tail) {
        const i = bfsQueue[head++]
        const x = i % mapW, y = Math.idiv(i, mapW), d = bfsDist[i]
        let sc = 999999
        if (itemType[i] != IT_NONE && !itemHidden[i]) sc = d - 7
        if (hasBombs && adjSoft(x, y)) sc = Math.min(sc, d + 2 + Math.random() * 2)
        for (const o of players) {
            if (o == p || !o.alive) continue
            const m = Math.abs(Math.round(o.x) - x) + Math.abs(Math.round(o.y) - y)
            sc = Math.min(sc, d + m * 1.2 + 6)
        }
        if (sc < bestScore) { bestScore = sc; best = i }
        if (d >= 24) continue
        for (const k of order) {
            const nx = x + DX[k], ny = y + DY[k]
            if (!walkableFor(p, nx, ny)) continue
            const j = I(nx, ny)
            if (bfsDist[j] >= 0 || dmap[j] != NEVER) continue
            bfsDist[j] = d + 1
            bfsPrev[j] = i
            bfsQueue[tail++] = j
        }
    }
    if (best < 0 || best == s) return -1
    return firstDir(s, best)
}

function aiPlan(p: Player, cx: number, cy: number) {
    const a = p.ai
    const dmap = dangerMap(dangerA, null)
    const s = I(cx, cy)
    const spd = p.speed
    // 1. standing in a blast zone? run to the nearest safe cell we can reach in time
    if (dmap[s] < NEVER) {
        a.dir = bfsDir(cx, cy, (nx, ny, j, d) => walkableFor(p, nx, ny) && dmap[j] > d / spd + 0.22,
            (i, d) => dmap[i] == NEVER, 14)
        return
    }
    // 2. drop a bomb only if there is an escape route from our own blast
    if (p.active < p.maxBombs && !bombAt(cx, cy) && grid[s] == CELL_FLOOR && wantsBomb(p, cx, cy)) {
        const d2 = dangerMap(dangerB, new Threat(cx, cy, p.range, BOMB_FUSE))
        const dir = bfsDir(cx, cy, (nx, ny, j, d) => walkableFor(p, nx, ny) && d2[j] > d / spd + 0.3,
            (i, d) => d2[i] == NEVER, 10)
        if (dir >= 0) { a.bomb = true; a.dir = dir; a.t = 0.05; return }
    }
    // 3. otherwise head for something worth having
    a.dir = aiGoal(p, cx, cy, dmap)
}

function aiThink(p: Player, dt: number): Input {
    const a = p.ai
    const out = new Input()
    const cx = Math.round(p.x), cy = Math.round(p.y)
    a.t -= dt
    if (a.t <= 0 || a.cx != cx || a.cy != cy) {
        a.t = 0.14 + Math.random() * 0.1
        a.cx = cx; a.cy = cy
        aiPlan(p, cx, cy)
    }
    if (a.bomb) { out.bomb = true; a.bomb = false }
    if (a.dir >= 0) out.held = [a.dir]
    else {
        // nowhere to go: settle into the middle of the tile
        const ox = p.x - cx, oy = p.y - cy
        if (Math.abs(ox) <= 0.09) p.x = cx; else out.held = [ox > 0 ? 3 : 1]
        if (Math.abs(oy) <= 0.09) p.y = cy; else if (!out.held.length) out.held = [oy > 0 ? 0 : 2]
    }
    return out
}
