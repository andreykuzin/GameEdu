// render.ts — draws one frame. Nothing here changes the game; it only looks
// at the world and paints it onto the 160x120 screen image `t`.

const BIG = image.doubledFont(image.font8)   // 12x16 letters for titles
const F5 = image.font5                        // tiny 6x5 letters for the HUD
const F8 = image.font8

// ---------------------------------------------------------------- text helpers
function printShadow(t: Image, s: string, x: number, y: number, c: number, f: image.Font) {
    t.print(s, x + 1, y + 1, 15, f)
    t.print(s, x, y, c, f)
}
function textWidth(s: string, f: image.Font): number { return s.length * f.charWidth }
function printC(t: Image, s: string, cx: number, y: number, c: number, f: image.Font) {
    printShadow(t, s, cx - Math.idiv(textWidth(s, f), 2), y, c, f)
}
function printR(t: Image, s: string, rx: number, y: number, c: number, f: image.Font) {
    t.print(s, rx - textWidth(s, f), y, c, f)
}
function flash(rate: number): boolean { return Math.floor(gameT * rate) % 2 == 1 }

// ---------------------------------------------------------------- tiles
function solidAt(x: number, y: number): boolean {
    if (!inb(x, y)) return false
    const g = grid[I(x, y)]
    return g == CELL_HARD || g == CELL_BRICK
}

function drawFloor(t: Image, x: number, y: number, sx: number, sy: number) {
    t.fillRect(sx, sy, T, T, 6)
    if ((x * 7 + y * 13) % 5 == 0) t.setPixel(sx + 5, sy + 3, 7)
    if (solidAt(x, y - 1)) t.fillRect(sx, sy, T, 2, 7)      // blocks cast a shadow down
    if (solidAt(x - 1, y)) t.fillRect(sx, sy, 1, T, 7)      // ... and to the right
}

function drawExit(t: Image, sx: number, sy: number, open: boolean) {
    t.fillRect(sx, sy, T, T, 14)
    t.fillRect(sx + 1, sy + 1, 6, 7, 13)
    const glow = open ? [5, 4, 1, 9][Math.floor(gameT * 8) % 4] : 15
    t.fillRect(sx + 2, sy + 2, 4, 6, glow)
    if (!open) { t.fillRect(sx + 2, sy + 6, 4, 1, 14); t.fillRect(sx + 3, sy + 4, 2, 1, 14) }
}

function drawItem(t: Image, type: number, sx: number, sy: number) {
    t.fillRect(sx, sy, T, T, flash(6) ? 1 : 5)
    t.fillRect(sx + 1, sy + 1, 6, 6, 8)
    t.drawTransparentImage(ICONS[type], sx + 1, sy + 1)
}

function drawBomb(t: Image, b: Bomb, sx: number, sy: number) {
    const fast = !b.remote && b.fuse < 0.8
    const big = Math.sin(b.t * (fast ? 26 : 12)) > 0 ? 1 : 0
    t.drawTransparentImage(BOMB_IMGS[big], sx, sy)
    t.setPixel(sx + 6 + big, sy - big, flash(20) ? 5 : 4)    // the fuse spark
    if (b.remote) t.fillRect(sx + 3, sy + 4, 2, 2, flash(4) ? 2 : 12)
}

function drawFlame(t: Image, f: Flame, sx: number, sy: number) {
    const ph = 1 - f.t / FLAME_T
    const k = ph < 0.12 ? ph / 0.12 : ph > 0.6 ? Math.max(0, (1 - ph) / 0.4) : 1
    const base = Math.max(1, Math.round(7 * k)) - (Math.floor(gameT * 30) % 2)
    const widths = [base, base - 2, base - 4]
    const colors = [4, 5, 1]
    for (let l = 0; l < 3; l++) {
        const lw = widths[l], c = colors[l]
        if (lw <= 0) continue
        const o = (T - lw) >> 1
        if (f.kind == 0) { t.fillRect(sx, sy + o, T, lw, c); t.fillRect(sx + o, sy, lw, T, c) }
        else if (f.kind == 1) {
            if (f.dir % 2) t.fillRect(sx, sy + o, T, lw, c); else t.fillRect(sx + o, sy, lw, T, c)
        } else {
            // the end of a flame arm has a rounded tip
            const tip = Math.max(0, lw - 2)
            if (f.dir == 1) { t.fillRect(sx, sy + o, 6, lw, c); t.fillRect(sx + 6, sy + o + 1, 1, tip, c) }
            else if (f.dir == 3) { t.fillRect(sx + 2, sy + o, 6, lw, c); t.fillRect(sx + 1, sy + o + 1, 1, tip, c) }
            else if (f.dir == 0) { t.fillRect(sx + o, sy + 2, lw, 6, c); t.fillRect(sx + o + 1, sy + 1, tip, 1, c) }
            else { t.fillRect(sx + o, sy, lw, 6, c); t.fillRect(sx + o + 1, sy + 6, tip, 1, c) }
        }
    }
}

// ---------------------------------------------------------------- characters
function drawBomber(t: Image, p: Player, sx: number, sy: number) {
    if (!p.alive) {
        if (p.dying <= 0) return
        // spin and flash while caught in the blast
        const face = Math.floor(p.dying * 14) % 4
        const img = Math.floor(p.dying * 16) % 2 ? bomberFlash[face] : bomberSprites[p.pal][face][0]
        t.drawTransparentImage(img, sx, sy)
        return
    }
    if (p.inv > 0 && p.inv < 3 && Math.floor(p.inv * 12) % 2) return    // blinking: about to lose the shield
    const frame = p.moving ? Math.floor(p.walk * 8) % 2 : 0
    let img = bomberSprites[p.pal][p.face][frame]
    if (p.inv >= 3 && flash(10)) img = bomberFlash[p.face]
    t.drawTransparentImage(img, sx, sy - frame)
}

function drawEnemy(t: Image, e: Enemy, sx: number, sy: number) {
    if (!e.alive) {
        if (e.dying < 0.5) return
        t.drawTransparentImage(Math.floor(e.dying * 20) % 2 ? enemyWhite[e.type] : enemyBurn[e.type], sx, sy)
        return
    }
    if (e.inv > 0 && flash(16)) { t.drawTransparentImage(enemyWhite[e.type], sx, sy); return }
    const frame = Math.floor(gameT * 4 + e.seed) % 2
    t.drawTransparentImage(enemySprites[e.type][frame], sx, sy)
    // pupils look where the enemy is going
    let ey = sy + EYE_Y[EN_SHAPE[e.type]]
    if (frame == 1 && EN_SHAPE[e.type] != 3) ey--
    const px = e.dir == 1 ? 1 : 0
    const py = e.dir == 2 ? 1 : 0
    t.setPixel(sx + 1 + px, ey + py, 15)
    t.setPixel(sx + 5 + px, ey + py, 15)
}

// ---------------------------------------------------------------- the frame
function render(t: Image) {
    t.fill(15)
    if (mode < 0) return
    if (mode == MODE_STORY && phase == "intro") {
        printC(t, "STAGE " + stage, 80, 42, 1, BIG)
        printC(t, "LEFT " + lives, 80, 70, 13, F8)
        return
    }
    let shx = 0, shy = 0
    if (shake > 0) { shx = randint(-1, 1); shy = randint(-1, 1) }
    const ox = -Math.round(cam) + shx
    const oy = HUD + shy
    const x0 = Math.max(0, Math.floor(cam / T) - 1)
    const x1 = Math.min(mapW - 1, Math.floor((cam + SCREEN_W) / T) + 1)
    let exitOpen = mode == MODE_STORY
    for (const e of enemies) if (e.alive) exitOpen = false

    for (let y = 0; y < mapH; y++) for (let x = x0; x <= x1; x++) {
        const i = I(x, y), g = grid[i], sx = ox + x * T, sy = oy + y * T
        if (g == CELL_HARD) { t.drawImage(HARD_IMG, sx, sy); continue }
        if (g == CELL_BRICK) { t.drawImage(BRICK_IMG, sx, sy); continue }
        drawFloor(t, x, y, sx, sy)
        if (g == CELL_BURNING) {
            const k = burn[i] / BURN_T
            const m = Math.round((1 - k) * 3)
            t.fillRect(sx + 1 + m, sy + 1 + m, 6 - m * 2, 6 - m * 2, flash(24) ? 4 : 5)
            continue
        }
        if (itemType[i] != IT_NONE && !itemHidden[i]) {
            if (itemType[i] == IT_EXIT) drawExit(t, sx, sy, exitOpen); else drawItem(t, itemType[i], sx, sy)
        }
    }
    for (const b of bombs) drawBomb(t, b, ox + Math.round(b.x * T), oy + Math.round(b.y * T))
    for (const f of flames) drawFlame(t, f, ox + f.x * T, oy + f.y * T)
    for (const e of enemies) drawEnemy(t, e, ox + Math.round(e.x * T), oy + Math.round(e.y * T))
    for (const p of players) drawBomber(t, p, ox + Math.round(p.x * T), oy + Math.round(p.y * T) - 1)
    for (const f of falling) {
        const k = f.t / 0.22
        t.drawImage(HARD_IMG, ox + f.x * T, oy + Math.round(f.y * T - k * 30))
    }
    for (const q of parts) t.setPixel(ox + Math.round(q.x), oy + Math.round(q.y), q.c)
    for (const q of pops) printC(t, q.text, ox + Math.round(q.x), oy + Math.round(q.y), q.color, F5)

    if (mode == MODE_STORY) hudStory(t); else hudBattle(t)
    banners(t)
}

// ---------------------------------------------------------------- status bar
function hudStory(t: Image) {
    const p = players[0]
    t.fillRect(0, 0, SCREEN_W, HUD, 13)
    t.fillRect(0, HUD - 1, SCREEN_W, 1, 14)
    t.print("TIME", 2, 2, 15, F5)
    t.print("" + Math.ceil(timeLeft), 28, 2, timeLeft < 30 ? 2 : 15, F5)
    printR(t, "" + score, 112, 2, 15, F5)
    printR(t, "LEFT " + Math.max(0, lives), 158, 2, 15, F5)
    t.drawTransparentImage(ICONS[IT_BOMB], 2, 8); t.print("" + p.maxBombs, 9, 9, 15, F5)
    t.drawTransparentImage(ICONS[IT_FIRE], 18, 8); t.print("" + p.range, 25, 9, 15, F5)
    t.drawTransparentImage(ICONS[IT_SPEED], 34, 8)
    t.print("" + (Math.round((p.speed - BASE_SPEED) / SPEED_STEP) + 1), 41, 9, 15, F5)
    let x = 52
    const have = [p.kick, p.remote, p.wallpass, p.bombpass, p.flamepass, p.inv > 3]
    const icons = [IT_KICK, IT_REMOTE, IT_WALLPASS, IT_BOMBPASS, IT_FLAMEPASS, IT_VEST]
    for (let k = 0; k < have.length; k++) if (have[k]) { t.drawTransparentImage(ICONS[icons[k]], x, 8); x += 8 }
    printR(t, "ST " + stage, 158, 9, 15, F5)
}

function hudBattle(t: Image) {
    t.fillRect(0, 0, SCREEN_W, HUD, 13)
    t.fillRect(0, HUD - 1, SCREEN_W, 1, 14)
    for (let i = 0; i < players.length; i++) {
        const p = players[i]
        const x = 3 + i * 28
        if (p.alive) t.drawTransparentImage(bomberSprites[p.pal][2][0], x, 4)
        else t.drawTransparentImage(bomberSprites[p.pal][0][0], x, 4)     // turned away = out
        t.print("" + p.roster.wins, x + 10, 6, 15, F5)
        if (p.cpu) t.print("C", x + 17, 6, 14, F5)
    }
    const s = Math.ceil(timeLeft)
    const sec = s % 60
    printR(t, Math.idiv(s, 60) + ":" + (sec < 10 ? "0" : "") + sec, 158, 6, hurry ? 2 : 15, F5)
}

function shortLabel(r: Roster): string {
    return r.cpu ? "C" + r.label.substr(3, 1) : r.label
}

function banners(t: Image) {
    const cy = HUD + Math.idiv(SCREEN_H - HUD, 2)
    if (mode == MODE_BATTLE && phase == "intro") {
        printC(t, demo ? "DEMO" : "ROUND " + round, 80, cy - 14, 1, BIG)
        if (!demo) printC(t, "FIRST TO " + TARGET_WINS, 80, cy + 6, 5, F8)
    }
    if (mode == MODE_BATTLE && phase == "roundEnd") {
        t.fillRect(0, cy - 16, SCREEN_W, 32, 15)
        printC(t, winner ? winner.label + " WINS" : "DRAW", 80, cy - 13, winner ? 5 : 1, BIG)
        let line = ""
        for (const r of roster) line += (line.length ? " " : "") + shortLabel(r) + ":" + r.wins
        printC(t, line, 80, cy + 7, 1, F5)
    }
    if (mode == MODE_STORY && phase == "clear") {
        t.fillRect(0, cy - 12, SCREEN_W, 24, 15)
        printC(t, "STAGE CLEAR", 80, cy - 8, 5, BIG)
    }
    const showHurry = mode == MODE_BATTLE ? timeLeft > 44 : gameT % 6 < 3
    if (hurry && phase == "play" && flash(3) && showHurry) printC(t, "HURRY UP!", 80, HUD + 3, 2, F5)
}
