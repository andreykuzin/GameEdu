// world.ts — the game world: the map, everything that lives on it, and the rules.
// Positions are measured in tiles (x = 3.5 means halfway between columns 3 and 4),
// and times in seconds, so the numbers in data.ts read naturally.

// ---------------------------------------------------------------- small helpers
function sgn(v: number): number { return v > 0 ? 1 : v < 0 ? -1 : 0 }
function clamp(v: number, a: number, b: number): number { return v < a ? a : v > b ? b : v }

// Story stages are generated from a seeded random number generator, so stage 7
// always has the same layout. Battle arenas use the normal Math.random().
let rngSeed = 0
let rngSeeded = false
function rnd(): number {
    if (!rngSeeded) return Math.random()
    // xorshift32: a tiny, fast pseudo-random generator
    rngSeed ^= rngSeed << 13
    rngSeed ^= rngSeed >>> 17
    rngSeed ^= rngSeed << 5
    return (rngSeed >>> 0) / 4294967296
}
function ri(n: number): number { return Math.floor(rnd() * n) }
function shuffle(a: number[]): number[] {
    for (let i = a.length - 1; i > 0; i--) {
        const j = ri(i + 1)
        const t = a[i]; a[i] = a[j]; a[j] = t
    }
    return a
}

// ---------------------------------------------------------------- things in the world
class Combo {
    // shared by every flame of a chain reaction: each kill doubles the next score
    kills = 0
    exit = false
    constructor() { }
}

class Ctrl {
    held: number[] = []        // directions held, most recent last
    bombTap = false
    detTap = false
    constructor(public pad: number) { }
}

class Roster {
    wins = 0
    constructor(public pal: number, public ctrl: Ctrl, public cpu: boolean, public label: string) { }
}

class AiState {
    t = 0
    dir = -1
    bomb = false
    cx = -1
    cy = -1
    constructor() { }
}

class Player {
    alive = true
    dying = 0
    face = 2
    walk = 0
    moving = false
    maxBombs = 1
    range = 1
    speed = BASE_SPEED
    active = 0                 // bombs currently on the map
    kick = false
    remote = false
    wallpass = false
    bombpass = false
    flamepass = false
    inv = 0                    // seconds of invincibility left
    ctrl: Ctrl = null
    cpu = false
    ai: AiState = null
    roster: Roster = null
    constructor(public x: number, public y: number, public pal: number) { }
}

class Bomb {
    passers: Player[] = []     // players standing on the bomb when it was placed may walk off it
    sdx = 0                    // slide direction after a kick
    sdy = 0
    sliding = false
    t = 0
    combo: Combo = null
    constructor(public x: number, public y: number, public owner: Player,
        public fuse: number, public range: number, public remote: boolean) { }
}

class Enemy {
    tx: number                 // the tile it is walking toward
    ty: number
    dir = -1
    dying = 0
    alive = true
    seed: number
    constructor(public type: number, public x: number, public y: number, public inv: number) {
        this.tx = x
        this.ty = y
        this.seed = Math.random() * 6
    }
}

class Flame {
    // kind: 0 centre, 1 middle, 2 end
    constructor(public x: number, public y: number, public kind: number, public dir: number, public t: number) { }
}
class Particle {
    constructor(public x: number, public y: number, public vx: number, public vy: number,
        public life: number, public c: number, public floaty: boolean) { }
}
class Pop {
    constructor(public x: number, public y: number, public text: string, public color: number, public t: number) { }
}
class Falling {
    constructor(public x: number, public y: number, public t: number) { }
}
class Input {
    held: number[] = []
    bomb = false
    det = false
    constructor() { }
}

// ---------------------------------------------------------------- the map
let mapW = 0
let mapH = 0
let grid: number[] = []        // CELL_FLOOR, CELL_HARD, CELL_BRICK or CELL_BURNING
let fire: number[] = []        // seconds of flame left on each cell
let fcombo: Combo[] = []       // which chain reaction the flame belongs to
let burn: number[] = []        // seconds left for a burning brick
let itemType: number[] = []    // IT_* hidden under or lying on each cell
let itemHidden: boolean[] = []

function I(x: number, y: number): number { return y * mapW + x }
function inb(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < mapW && y < mapH }

function newMap(w: number, h: number) {
    mapW = w; mapH = h
    grid = []; fire = []; fcombo = []; burn = []; itemType = []; itemHidden = []
    for (let i = 0; i < w * h; i++) {
        grid.push(0); fire.push(0); fcombo.push(null); burn.push(0); itemType.push(IT_NONE); itemHidden.push(false)
    }
    // the border and every other cell are indestructible blocks
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
        if (x == 0 || y == 0 || x == w - 1 || y == h - 1 || (x % 2 == 0 && y % 2 == 0)) grid[I(x, y)] = CELL_HARD
}
function setItem(i: number, type: number, hidden: boolean) { itemType[i] = type; itemHidden[i] = hidden }

// ---------------------------------------------------------------- game state
const MODE_STORY = 0
const MODE_BATTLE = 1

let mode = -1                  // -1 until the first game starts
let demo = false               // the CPU-only battle behind the title screen
let phase = ""                 // "intro", "play", "dying", "clear", "roundEnd", "over"
let phaseT = 0
let gameT = 0                  // seconds since the stage started (drives animations)
let timeLeft = 0
let hurry = false
let shake = 0
let cam = 0                    // horizontal scroll in pixels
let camMax = 0

let players: Player[] = []
let enemies: Enemy[] = []
let bombs: Bomb[] = []
let flames: Flame[] = []
let parts: Particle[] = []
let pops: Pop[] = []
let falling: Falling[] = []

// story
let stage = 1
let score = 0
let lives = 2
let keep: Player = null        // power-ups carried to the next stage
let exitIdx = 0
let exitCd = 0
let topTier = 0
let wasOpen = false

// battle
let roster: Roster[] = []
let round = 0
const TARGET_WINS = 3
let humans = 1
let cpus = 3
let spiral: number[] = []
let spiralT = 0
let endCheck = -1
let winner: Roster = null

const ctrl1 = new Ctrl(1)
const ctrl2 = new Ctrl(2)

function makeEnemy(type: number, x: number, y: number, inv: number): Enemy {
    return new Enemy(type, x, y, inv)
}

function resetLists() {
    enemies = []; bombs = []; flames = []; parts = []; pops = []; falling = []
    hurry = false; shake = 0
}

// ---------------------------------------------------------------- story mode
function stageEnemies(n: number): number[] {
    const out: number[] = []
    if (n <= FIXED_STAGES.length) {
        const f = FIXED_STAGES[n - 1]
        for (let k = 0; k < f.length; k += 2) for (let c = 0; c < f[k + 1]; c++) out.push(f[k])
        return out
    }
    const count = Math.min(10, 6 + Math.floor(n / 6))
    const top = Math.min(n >= 30 ? 7 : 6, 2 + Math.floor(n / 4))
    for (let i = 0; i < count; i++) out.push(top - Math.floor(rnd() * rnd() * (top + 1)))
    return out
}

function startStory(st: number) {
    mode = MODE_STORY; demo = false
    stage = st; score = 0; lives = 2; gameT = 0
    keep = new Player(0, 0, 0)
    loadStage()
}

function loadStage() {
    const n = stage
    rngSeed = n * 7919 + 101; rngSeeded = true
    newMap(31, 13)
    const dens = Math.min(0.42, 0.3 + n * 0.004)
    const softs: number[] = []
    for (let y = 1; y < mapH - 1; y++) for (let x = 1; x < mapW - 1; x++) {
        const i = I(x, y)
        const spawnZone = (x <= 2 && y <= 1) || (x <= 1 && y <= 2)
        if (grid[i] == CELL_FLOOR && !spawnZone && rnd() < dens) { grid[i] = CELL_BRICK; softs.push(i) }
    }
    shuffle(softs)
    setItem(softs[0], IT_EXIT, true)
    setItem(softs[1], STAGE_ITEMS[(n - 1) % STAGE_ITEMS.length], true)
    if (rnd() < 0.7) setItem(softs[2], [IT_BOMB, IT_FIRE, IT_SPEED][ri(3)], true)
    exitIdx = softs[0]
    const floors: number[] = []
    for (let y = 1; y < mapH - 1; y++) for (let x = 1; x < mapW - 1; x++)
        if (grid[I(x, y)] == CELL_FLOOR && x + y >= 9) floors.push(I(x, y))
    shuffle(floors)
    resetLists()
    const list = stageEnemies(n)
    topTier = 0
    for (let k = 0; k < list.length; k++) {
        const f = floors[k % floors.length]
        enemies.push(makeEnemy(list[k], f % mapW, Math.idiv(f, mapW), 0))
        topTier = Math.max(topTier, list[k])
    }
    rngSeeded = false

    const p = new Player(1, 1, 0)
    p.maxBombs = keep.maxBombs; p.range = keep.range; p.speed = keep.speed; p.kick = keep.kick
    p.remote = keep.remote; p.wallpass = keep.wallpass; p.bombpass = keep.bombpass; p.flamepass = keep.flamepass
    p.ctrl = ctrl1; p.inv = 2.5
    players = [p]
    timeLeft = 200; exitCd = 0; wasOpen = false
    cam = 0; camMax = mapW * T - SCREEN_W
    phase = "intro"; phaseT = 2.2
    musicStop(); musicTempo = 148
}

function keepPowers(p: Player, all: boolean) {
    keep.maxBombs = p.maxBombs; keep.range = p.range; keep.speed = p.speed; keep.kick = p.kick
    // the classic rule: when you lose a life you keep bomb/fire/speed/kick but lose the specials
    keep.remote = all && p.remote; keep.wallpass = all && p.wallpass
    keep.bombpass = all && p.bombpass; keep.flamepass = all && p.flamepass
}

// ---------------------------------------------------------------- battle mode
function startBattle(h: number, c: number, isDemo: boolean) {
    mode = MODE_BATTLE; demo = isDemo
    humans = h; cpus = c
    roster = []
    for (let i = 0; i < h + c; i++) {
        const human = i < h
        const ctl = human ? (i == 0 ? ctrl1 : ctrl2) : null
        roster.push(new Roster(i, ctl, !human, human ? BOMBER_LABEL[i] : "CPU" + (i + 1 - h)))
    }
    round = 0; gameT = 0
    loadArena()
}

function spiralCells(w: number, h: number): number[] {
    const out: number[] = []
    let x0 = 1, y0 = 1, x1 = w - 2, y1 = h - 2
    while (x0 <= x1 && y0 <= y1) {
        for (let x = x0; x <= x1; x++) out.push(y0 * w + x)
        for (let y = y0 + 1; y <= y1; y++) out.push(y * w + x1)
        if (y0 < y1) for (let x = x1 - 1; x >= x0; x--) out.push(y1 * w + x)
        if (x0 < x1) for (let y = y1 - 1; y > y0; y--) out.push(y * w + x0)
        x0++; y0++; x1--; y1--
    }
    return out
}

const SPAWN_X = [1, 13, 13, 1]
const SPAWN_Y = [1, 11, 1, 11]
function loadArena() {
    rngSeeded = false
    newMap(15, 13)
    for (let y = 1; y < mapH - 1; y++) for (let x = 1; x < mapW - 1; x++) {
        let near = false
        for (let s = 0; s < 4; s++) if (Math.abs(x - SPAWN_X[s]) + Math.abs(y - SPAWN_Y[s]) <= 1) near = true
        const i = I(x, y)
        if (grid[i] == CELL_FLOOR && !near && Math.random() < 0.8) grid[i] = CELL_BRICK
    }
    round++
    resetLists()
    players = []
    for (let i = 0; i < roster.length; i++) {
        const r = roster[i]
        const p = new Player(SPAWN_X[i], SPAWN_Y[i], r.pal)
        p.ctrl = r.ctrl; p.cpu = r.cpu; p.roster = r
        if (r.cpu) p.ai = new AiState()
        p.face = i % 2 ? 0 : 2
        players.push(p)
    }
    timeLeft = 120
    spiral = spiralCells(15, 13); spiralT = 0
    cam = -(SCREEN_W - 15 * T) / 2; camMax = cam
    phase = "intro"; phaseT = 1.6; endCheck = -1; winner = null
    musicTempo = 160
}

// ---------------------------------------------------------------- rules
function bombAt(x: number, y: number): Bomb {
    for (const b of bombs) if (Math.round(b.x) == x && Math.round(b.y) == y) return b
    return null
}
function overlap(p: Player, x: number, y: number): boolean {
    return Math.abs(p.x - x) < 0.98 && Math.abs(p.y - y) < 0.98
}
function canEnter(p: Player, x: number, y: number): boolean {
    if (!inb(x, y)) return false
    const g = grid[I(x, y)]
    if (g == CELL_HARD) return false
    if (g >= CELL_BRICK && !p.wallpass) return false
    const b = bombAt(x, y)
    if (b && !p.bombpass && b.passers.indexOf(p) < 0) return false
    return true
}

// Grid movement with corner assist: if you push into a wall while slightly off
// a lane, you get nudged into the open lane instead of stopping dead.
function moveAxis(p: Player, dx: number, dy: number, dist: number): boolean {
    const cx = Math.round(p.x), cy = Math.round(p.y)
    const horiz = dx != 0
    const d = horiz ? dx : dy
    const tx = cx + dx, ty = cy + dy
    const open = canEnter(p, tx, ty)
    const off = horiz ? p.y - cy : p.x - cx
    if (Math.abs(off) > 0.001) {
        if (!open) {
            const s = sgn(off)
            const lx = horiz ? tx : cx + s, ly = horiz ? cy + s : ty
            const bx = horiz ? cx : cx + s, by = horiz ? cy + s : cy
            if (Math.abs(off) > 0.2 && canEnter(p, lx, ly) && canEnter(p, bx, by)) {
                const m = Math.min(dist, 1 - Math.abs(off))
                if (horiz) p.y += s * m; else p.x += s * m
                return true
            }
            return false
        }
        const m = Math.min(dist, Math.abs(off))
        if (horiz) p.y -= sgn(off) * m; else p.x -= sgn(off) * m
        dist -= m
        if (dist <= 0) return true
    }
    if (horiz) p.y = cy; else p.x = cx
    const along = horiz ? p.x : p.y
    const c = horiz ? cx : cy
    let n = along + d * dist
    if (!open) {
        if (d > 0) n = Math.min(n, Math.max(along, c)); else n = Math.max(n, Math.min(along, c))
        if (p.kick && Math.abs(along - c) < 0.1) {
            const b = bombAt(tx, ty)
            if (b && !b.sliding && bombFree(tx + dx, ty + dy, b)) {
                b.sliding = true; b.sdx = dx; b.sdy = dy; sfx("kick")
            }
        }
    }
    if (horiz) p.x = n; else p.y = n
    return Math.abs(n - along) > 0.000001
}

function bombFree(x: number, y: number, self: Bomb): boolean {
    if (!inb(x, y) || grid[I(x, y)] != CELL_FLOOR) return false
    for (const b of bombs) if (b != self && Math.round(b.x) == x && Math.round(b.y) == y) return false
    for (const p of players) if (p.alive && Math.round(p.x) == x && Math.round(p.y) == y) return false
    for (const e of enemies)
        if (e.alive && ((Math.round(e.x) == x && Math.round(e.y) == y) || (e.tx == x && e.ty == y))) return false
    return true
}

function placeBomb(p: Player): boolean {
    const cx = Math.round(p.x), cy = Math.round(p.y)
    if (p.active >= p.maxBombs || grid[I(cx, cy)] != CELL_FLOOR || bombAt(cx, cy)) return false
    const b = new Bomb(cx, cy, p, BOMB_FUSE, p.range, p.remote)
    for (const o of players) if (o.alive && overlap(o, cx, cy)) b.passers.push(o)
    bombs.push(b); p.active++
    sfx("place")
    return true
}

function detonate(p: Player) {
    if (!p.remote) return
    for (const b of bombs) if (b.owner == p && b.remote) { b.remote = false; b.fuse = 0; return }
}

function addFlame(x: number, y: number, kind: number, dir: number, combo: Combo): Flame {
    const f = new Flame(x, y, kind, dir, FLAME_T)
    flames.push(f)
    const i = I(x, y)
    fire[i] = FLAME_T; fcombo[i] = combo
    return f
}

function explode(b: Bomb) {
    const k = bombs.indexOf(b)
    if (k < 0) return
    bombs.removeAt(k)
    if (b.owner) b.owner.active = Math.max(0, b.owner.active - 1)
    const bx = Math.round(b.x), by = Math.round(b.y)
    const combo = b.combo ? b.combo : new Combo()
    addFlame(bx, by, 0, -1, combo)
    for (let d = 0; d < 4; d++) {
        let last: Flame = null
        for (let s = 1; s <= b.range; s++) {
            const x = bx + DX[d] * s, y = by + DY[d] * s
            if (!inb(x, y)) break
            const i = I(x, y), g = grid[i]
            if (g == CELL_HARD || g == CELL_BURNING) break
            if (g == CELL_BRICK) {
                grid[i] = CELL_BURNING; burn[i] = BURN_T
                debris(x, y); softDestroyed(i)
                break
            }
            const ob = bombAt(x, y)
            if (ob) {
                // chain reaction: the other bomb goes off almost at once and joins this combo
                ob.fuse = Math.min(ob.fuse, 0.07); ob.remote = false; ob.combo = combo
                if (ob.sliding) { ob.sliding = false; ob.x = x; ob.y = y }
                break
            }
            last = addFlame(x, y, 1, d, combo)
            if (itemType[i] != IT_NONE && !itemHidden[i]) {
                if (itemType[i] == IT_EXIT) {
                    if (mode == MODE_STORY && !combo.exit && exitCd <= 0) { combo.exit = true; exitCd = 1.5; spawnFromExit(x, y) }
                } else { setItem(i, IT_NONE, false); poof(x, y) }
                break
            }
        }
        if (last) last.kind = 2
    }
    shake = Math.max(shake, 0.18)
    sfx("boom")
}

function softDestroyed(i: number) {
    if (mode != MODE_BATTLE || Math.random() > 0.34) return
    const r = Math.random()
    setItem(i, r < 0.36 ? IT_BOMB : r < 0.72 ? IT_FIRE : r < 0.9 ? IT_SPEED : IT_KICK, true)
}

function spawnFromExit(x: number, y: number) {
    // bombing the exit releases four enemies one tier tougher than the stage's toughest
    const type = Math.min(PONTAN, topTier + 1)
    for (let k = 0; k < 4; k++) enemies.push(makeEnemy(type, x, y, 1.6))
    pop(x, y, "UH-OH", 2)
    sfx("spawn")
}

function applyItem(p: Player, type: number) {
    if (type == IT_BOMB) p.maxBombs = Math.min(10, p.maxBombs + 1)
    else if (type == IT_FIRE) p.range = Math.min(10, p.range + 1)
    else if (type == IT_SPEED) p.speed = Math.min(MAX_SPEED, p.speed + SPEED_STEP)
    else if (type == IT_KICK) p.kick = true
    else if (type == IT_REMOTE) p.remote = true
    else if (type == IT_WALLPASS) p.wallpass = true
    else if (type == IT_BOMBPASS) p.bombpass = true
    else if (type == IT_FLAMEPASS) p.flamepass = true
    else if (type == IT_VEST) p.inv = 18
    else if (type == IT_HEART && mode == MODE_STORY) lives++
    if (mode == MODE_STORY) score += 1000
    pop(p.x, p.y, ITEM_NAME[type], 5)
    sfx("item")
}

function killPlayer(p: Player) {
    if (!p.alive) return
    p.alive = false; p.dying = 1.4
    sfx("die")
    if (mode == MODE_STORY) { phase = "dying"; phaseT = 2.8; musicStop() }
}

function killEnemy(e: Enemy, combo: Combo) {
    e.alive = false; e.dying = 1.1
    const n = combo ? combo.kills : 0
    const pts = EN_PTS[e.type] * (1 << Math.min(n, 4))
    if (combo) combo.kills++
    score += pts
    pop(e.x, e.y, "" + pts, n ? 5 : 1)
    sfx("enemy")
}

// ---------------------------------------------------------------- effects (in pixels)
function debris(x: number, y: number) {
    for (let k = 0; k < 5; k++)
        parts.push(new Particle(x * T + 4, y * T + 4, (Math.random() - 0.5) * 70, -20 - Math.random() * 55, 0.55, k % 2 ? 11 : 12, false))
}
function poof(x: number, y: number) {
    for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2
        parts.push(new Particle(x * T + 4, y * T + 4, Math.cos(a) * 30, Math.sin(a) * 30, 0.4, 1, true))
    }
}
function pop(x: number, y: number, text: string, color: number) {
    pops.push(new Pop(x * T + 4, y * T - 2, text, color, 1.1))
}

// ---------------------------------------------------------------- update
function updatePlayer(p: Player, dt: number) {
    if (!p.alive) { if (p.dying > 0) p.dying -= dt; return }
    if (p.inv > 0) p.inv -= dt
    const inp = phase != "play" ? new Input() : p.cpu ? aiThink(p, dt) : pollCtrl(p.ctrl)
    if (inp.bomb) placeBomb(p)
    const h = inp.held
    let moved = false
    for (let k = h.length - 1; k >= 0; k--) {
        const d = h[k]
        if (moveAxis(p, DX[d], DY[d], p.speed * dt)) { moved = true; p.face = d; break }
        if (k == h.length - 1) p.face = d
    }
    p.moving = moved
    if (moved) p.walk += dt
    if (inp.det) detonate(p)
    const i = I(Math.round(p.x), Math.round(p.y))
    if (itemType[i] != IT_NONE && itemType[i] != IT_EXIT && !itemHidden[i] && grid[i] == CELL_FLOOR) {
        const t = itemType[i]
        setItem(i, IT_NONE, false)
        applyItem(p, t)
    }
}

function slideBomb(b: Bomb, dt: number) {
    const cx = Math.round(b.x), cy = Math.round(b.y)
    const along = b.sdx ? b.x - cx : b.y - cy
    const d = b.sdx ? b.sdx : b.sdy
    if (along * d >= -0.001 && !bombFree(cx + b.sdx, cy + b.sdy, b)) {
        b.x = cx; b.y = cy; b.sliding = false
        return
    }
    b.x += b.sdx * 8 * dt
    b.y += b.sdy * 8 * dt
}

function update(dt: number) {
    if (mode < 0) return
    gameT += dt
    if (shake > 0) shake -= dt
    if (phase == "intro") {
        phaseT -= dt
        if (phaseT <= 0) {
            phase = "play"
            if (!demo) { sfx("start"); musicStart() }
        }
        if (mode == MODE_STORY) return
    }
    if (phase == "play") {
        timeLeft -= dt
        if (mode == MODE_STORY && timeLeft <= 0 && !hurry) {
            // out of time: Pontans, the fastest enemies, come hunting
            hurry = true; timeLeft = 0; sfx("hurry"); musicTempo = 190
            const p = players[0]
            const spots: number[] = []
            for (let y = 1; y < mapH - 1; y++) for (let x = 1; x < mapW - 1; x++)
                if (grid[I(x, y)] != CELL_HARD && Math.abs(x - p.x) + Math.abs(y - p.y) > 10) spots.push(I(x, y))
            shuffle(spots)
            for (let k = 0; k < 6 && k < spots.length; k++) enemies.push(makeEnemy(PONTAN, spots[k] % mapW, Math.idiv(spots[k], mapW), 1))
        }
        if (mode == MODE_BATTLE && timeLeft <= 50 && !hurry) { hurry = true; sfx("hurry"); musicTempo = 196 }
        if (timeLeft < 0) timeLeft = 0
    }
    if (exitCd > 0) exitCd -= dt

    for (const p of players) updatePlayer(p, dt)

    for (const b of bombs.slice(0)) {
        b.t += dt
        const bx = Math.round(b.x), by = Math.round(b.y)
        for (let k = b.passers.length - 1; k >= 0; k--) {
            const o = b.passers[k]
            if (!o.alive || !overlap(o, bx, by)) b.passers.removeAt(k)
        }
        if (b.sliding) slideBomb(b, dt)
        if (!b.remote) { b.fuse -= dt; if (b.fuse <= 0) explode(b) }
    }
    for (let i = flames.length - 1; i >= 0; i--) { flames[i].t -= dt; if (flames[i].t <= 0) flames.removeAt(i) }
    const n = mapW * mapH
    for (let i = 0; i < n; i++) {
        if (fire[i] > 0) { fire[i] -= dt; if (fire[i] <= 0) { fire[i] = 0; fcombo[i] = null } }
        if (grid[i] == CELL_BURNING) {
            burn[i] -= dt
            if (burn[i] <= 0) { grid[i] = CELL_FLOOR; itemHidden[i] = false }
        }
    }

    // battle sudden death: hard blocks drop in a spiral from the outside in
    if (mode == MODE_BATTLE && hurry && phase == "play") {
        spiralT -= dt
        while (spiralT <= 0 && spiral.length) {
            const c = spiral.shift()
            if (grid[c] == CELL_HARD) continue
            falling.push(new Falling(c % mapW, Math.idiv(c, mapW), 0.22))
            spiralT += 0.24
        }
    }
    for (let k = falling.length - 1; k >= 0; k--) {
        const f = falling[k]
        f.t -= dt
        if (f.t <= 0) {
            falling.removeAt(k)
            const i = I(f.x, f.y)
            grid[i] = CELL_HARD; setItem(i, IT_NONE, false)
            const b = bombAt(f.x, f.y)
            if (b) { bombs.removeElement(b); if (b.owner) b.owner.active = Math.max(0, b.owner.active - 1) }
            for (const p of players) if (p.alive && Math.round(p.x) == f.x && Math.round(p.y) == f.y) killPlayer(p)
            shake = Math.max(shake, 0.08); sfx("thud")
        }
    }

    for (const e of enemies) updateEnemy(e, dt)
    for (let k = enemies.length - 1; k >= 0; k--) if (!enemies[k].alive && enemies[k].dying <= 0) enemies.removeAt(k)

    // damage: flames hurt everyone, enemies hurt players
    for (const p of players) {
        if (!p.alive) continue
        const i = I(Math.round(p.x), Math.round(p.y))
        if (fire[i] > 0.05 && !p.flamepass && p.inv <= 0) killPlayer(p)
    }
    for (const e of enemies) {
        if (!e.alive || e.inv > 0) continue
        const i = I(Math.round(e.x), Math.round(e.y))
        if (fire[i] > 0.05) killEnemy(e, fcombo[i])
    }
    for (const p of players) {
        if (!p.alive || p.inv > 0) continue
        for (const e of enemies)
            if (e.alive && Math.abs(e.x - p.x) < 0.68 && Math.abs(e.y - p.y) < 0.68) { killPlayer(p); break }
    }

    for (let k = parts.length - 1; k >= 0; k--) {
        const q = parts[k]
        q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt
        if (!q.floaty) q.vy += 210 * dt
        if (q.life <= 0) parts.removeAt(k)
    }
    for (let k = pops.length - 1; k >= 0; k--) {
        const q = pops[k]
        q.t -= dt; q.y -= 7 * dt
        if (q.t <= 0) pops.removeAt(k)
    }

    if (mode == MODE_STORY) updateStory(dt); else updateBattle(dt)
}

function updateStory(dt: number) {
    const p = players[0]
    const target = (p.x + 0.5) * T - SCREEN_W / 2
    cam += (clamp(target, 0, camMax) - cam) * Math.min(1, dt * 10)
    if (phase == "play") {
        const ex = exitIdx % mapW, ey = Math.idiv(exitIdx, mapW)
        let open = true
        for (const e of enemies) if (e.alive) open = false
        const shown = !itemHidden[exitIdx]
        if (open && !wasOpen) { wasOpen = true; if (shown) sfx("exit") }
        if (!open) wasOpen = false
        if (p.alive && open && shown && Math.abs(p.x - ex) < 0.3 && Math.abs(p.y - ey) < 0.3) {
            phase = "clear"; phaseT = 3; musicStop(); sfx("clear")
            const bonus = Math.ceil(timeLeft) * 10
            score += bonus
            pop(ex, ey - 1, "BONUS " + bonus, 5)
            keepPowers(p, true)
        }
    } else if (phase == "clear") {
        phaseT -= dt
        if (phaseT <= 0) {
            if (stage >= MAX_STAGE) { finishStory(true); return }
            stage++
            loadStage()
        }
    } else if (phase == "dying") {
        phaseT -= dt
        if (phaseT <= 0) {
            lives--
            keepPowers(p, false)
            if (lives < 0) finishStory(false); else loadStage()
        }
    }
}

function updateBattle(dt: number) {
    if (phase == "play") {
        let alive = 0
        for (const p of players) if (p.alive) alive++
        if (alive <= 1 && endCheck < 0) endCheck = 1.0
        if (endCheck >= 0) {
            endCheck -= dt
            if (endCheck < 0) {
                // wait a moment so a double knock-out counts as a draw
                winner = null
                let still = 0
                for (const p of players) if (p.alive) { still++; winner = p.roster }
                if (still != 1) winner = null
                if (winner) winner.wins++
                phase = "roundEnd"; phaseT = 3; musicStop()
                if (winner) sfx("clear")
            }
        }
    } else if (phase == "roundEnd") {
        phaseT -= dt
        if (phaseT <= 0) {
            if (winner && winner.wins >= TARGET_WINS) {
                if (demo) { for (const r of roster) r.wins = 0; round = 0; loadArena() }
                else finishBattle(winner)
            } else loadArena()
        }
    }
}
