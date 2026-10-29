// main.ts — menus, buttons, saved scores and the game loop.
// Start reading here: the bottom of this file is where the game begins.
//
// Controls on the Retro Arcade:
//   D-pad  move            A  drop a bomb      B  detonate (with the DETONATOR power-up)
//   MENU   pause           In menus: D-pad to choose, A to confirm, B to go back.

// ---------------------------------------------------------------- menus
const OV_NONE = 0
const OV_TITLE = 1
const OV_PAUSE = 2
const OV_END = 3
let overlay = OV_NONE
let cursor = 0
let paused = false
let endTitle = ""
let endLines: string[] = []
let canContinue = false
let continueStage = 1
let lastStart: () => void = null
let cfgHumans = 1
let cfgCpus = 3

function readSetting(key: string, def: number): number {
    return settings.exists(key) ? settings.readNumber(key) : def
}

function menuItems(): string[] {
    if (overlay == OV_TITLE) return ["STORY", "BATTLE", "PLAYERS  < " + cfgHumans + " >", "CPU      < " + cfgCpus + " >"]
    if (overlay == OV_PAUSE) return ["RESUME", "RESTART", "MUSIC: " + (musicOn ? "ON" : "OFF"), "QUIT"]
    if (overlay == OV_END) return canContinue ? ["CONTINUE ST." + continueStage, "PLAY AGAIN", "TITLE"] : ["PLAY AGAIN", "TITLE"]
    return []
}

// a battle needs 2 to 4 bombers in total
function syncCfg() {
    if (cfgHumans + cfgCpus > 4) cfgCpus = 4 - cfgHumans
    if (cfgHumans + cfgCpus < 2) cfgCpus = 2 - cfgHumans
    settings.writeNumber("humans", cfgHumans)
    settings.writeNumber("cpus", cfgCpus)
}

function begin(start: () => void) {
    paused = false
    overlay = OV_NONE
    sfxMuted = false
    toneQueue = []
    ctrl1.bombTap = ctrl1.detTap = false
    ctrl2.bombTap = ctrl2.detTap = false
    lastStart = start
    start()
}

function toTitle() {
    paused = false
    musicStop()
    sfxMuted = true            // the demo battle behind the title plays silently
    startBattle(0, 4, true)
    overlay = OV_TITLE
    cursor = 0
}

function finishStory(won: boolean) {
    musicStop()
    const hi = Math.max(readSetting("hi", 0), score)
    settings.writeNumber("hi", hi)
    settings.writeNumber("best", Math.max(readSetting("best", 1), stage))
    endTitle = won ? "YOU WIN!" : "GAME OVER"
    endLines = ["SCORE " + score, "STAGE " + stage + "   HI " + hi]
    canContinue = !won
    continueStage = stage
    phase = "over"
    overlay = OV_END
    cursor = 0
}

function finishBattle(w: Roster) {
    musicStop()
    endTitle = w.label + " WINS!"
    let line = ""
    for (const r of roster) line += (line.length ? "  " : "") + shortLabel(r) + " " + r.wins
    endLines = ["CHAMPION OF THE ARENA", line]
    canContinue = false
    phase = "over"
    overlay = OV_END
    cursor = 0
}

function setPaused(v: boolean) {
    if (mode < 0 || demo || phase == "over") return
    paused = v
    overlay = v ? OV_PAUSE : OV_NONE
    cursor = 0
}

function menuMove(d: number) {
    const n = menuItems().length
    if (!n) return
    cursor = (cursor + d + n) % n
    sfx("menu")
}

function menuAdjust(d: number) {
    if (overlay != OV_TITLE) return
    if (cursor == 2) { cfgHumans = clamp(cfgHumans + d, 1, 2); syncCfg(); sfx("menu") }
    if (cursor == 3) { cfgCpus = clamp(cfgCpus + d, 0, 3); syncCfg(); sfx("menu") }
}

function menuSelect() {
    sfxMuted = false
    const item = menuItems()[cursor]
    if (overlay == OV_TITLE) {
        if (cursor == 0) begin(() => startStory(1))
        else if (cursor == 1) {
            const h = cfgHumans, c = cfgCpus
            begin(() => startBattle(h, c, false))
        } else menuAdjust(1)
    } else if (overlay == OV_PAUSE) {
        if (cursor == 0) setPaused(false)
        else if (cursor == 1) { if (lastStart) begin(lastStart) }
        else if (cursor == 2) { musicOn = !musicOn; settings.writeNumber("music", musicOn ? 1 : 0) }
        else toTitle()
    } else if (overlay == OV_END) {
        if (item == "TITLE") toTitle()
        else if (item == "PLAY AGAIN") {
            if (mode == MODE_STORY) begin(() => startStory(1))
            else { const h = humans, c = cpus; begin(() => startBattle(h, c, false)) }
        } else {
            const st = continueStage
            begin(() => startStory(st))
        }
    }
}

function drawPanel(t: Image, x: number, y: number, w: number, h: number) {
    t.fillRect(x, y, w, h, 15)
    t.drawRect(x, y, w, h, 14)
    t.drawRect(x + 1, y + 1, w - 2, h - 2, 13)
}

function drawMenuList(t: Image, items: string[], y: number) {
    for (let k = 0; k < items.length; k++) {
        const sel = k == cursor
        const w = textWidth(items[k], F8)
        const x = 80 - Math.idiv(w, 2)
        if (sel) t.print(">", x - 10, y + k * 11, 5, F8)
        t.print(items[k], x, y + k * 11, sel ? 5 : 1, F8)
    }
}

function drawOverlay(t: Image) {
    if (overlay == OV_TITLE) {
        drawPanel(t, 12, 4, 136, 113)
        // two-colour logo: print the shadow first, then the letters on top
        t.print("BOMBER", 80 - 36 + 2, 8 + 2, 4, BIG); t.print("BOMBER", 80 - 36, 8, 5, BIG)
        t.print("BLITZ", 80 - 30 + 2, 25 + 2, 8, BIG); t.print("BLITZ", 80 - 30, 25, 1, BIG)
        drawMenuList(t, menuItems(), 47)
        printC(t, "HI " + readSetting("hi", 0) + "  BEST ST." + readSetting("best", 1), 80, 93, 5, F5)
        printC(t, "A:SELECT  <>:CHANGE", 80, 104, 13, F5)
    } else if (overlay == OV_PAUSE) {
        drawPanel(t, 28, 22, 104, 78)
        printC(t, "PAUSED", 80, 28, 5, F8)
        drawMenuList(t, menuItems(), 46)
    } else if (overlay == OV_END) {
        drawPanel(t, 10, 18, 140, 88)
        printC(t, endTitle, 80, 24, 5, endTitle.length <= 10 ? BIG : F8)
        for (let k = 0; k < endLines.length; k++) printC(t, endLines[k], 80, 46 + k * 9, 1, F5)
        drawMenuList(t, menuItems(), 68)
    }
}

// ---------------------------------------------------------------- buttons
// Player 1: menus and gameplay. Player 2 joins in 2-player battle
// (two Retro Arcades linked together, or the second keyboard set in the simulator).
controller.player1.up.onEvent(ControllerButtonEvent.Pressed, () => { if (overlay) menuMove(-1) })
controller.player1.down.onEvent(ControllerButtonEvent.Pressed, () => { if (overlay) menuMove(1) })
controller.player1.left.onEvent(ControllerButtonEvent.Pressed, () => { if (overlay) menuAdjust(-1) })
controller.player1.right.onEvent(ControllerButtonEvent.Pressed, () => { if (overlay) menuAdjust(1) })
controller.player1.A.onEvent(ControllerButtonEvent.Pressed, () => {
    if (overlay) menuSelect(); else ctrl1.bombTap = true
})
controller.player1.B.onEvent(ControllerButtonEvent.Pressed, () => {
    if (overlay == OV_PAUSE) setPaused(false)
    else if (!overlay) ctrl1.detTap = true
})
controller.menu.onEvent(ControllerButtonEvent.Pressed, () => {
    if (overlay == OV_PAUSE) setPaused(false)
    else if (overlay == OV_TITLE) { cursor = 0; menuSelect() }
    else if (!overlay) setPaused(true)
})
controller.player2.A.onEvent(ControllerButtonEvent.Pressed, () => { if (!overlay) ctrl2.bombTap = true })
controller.player2.B.onEvent(ControllerButtonEvent.Pressed, () => { if (!overlay) ctrl2.detTap = true })

// ---------------------------------------------------------------- game loop
// The screen refreshes as fast as the device can manage, but the game logic
// always advances in fixed 1/30 s steps, so the game runs at the same speed
// on the simulator and on the Retro Arcade.
let lastMs = 0
let stepAcc = 0
game.onUpdate(() => {
    const now = game.runtime()
    let dt = lastMs ? (now - lastMs) / 1000 : 0
    lastMs = now
    if (dt > 0.1) dt = 0.1
    if (!paused) {
        stepAcc += dt
        let n = 0
        while (stepAcc >= STEP && n < 3) { update(STEP); stepAcc -= STEP; n++ }
        if (stepAcc > STEP) stepAcc = 0
    }
    audioTick(paused)
})

scene.setBackgroundColor(15)
scene.createRenderable(10, (target: Image, camera: scene.Camera) => {
    render(target)
    drawOverlay(target)
})

// ---------------------------------------------------------------- start!
buildBomberSprites()
buildEnemySprites()
musicOn = readSetting("music", 1) == 1
cfgHumans = readSetting("humans", 1)
cfgCpus = readSetting("cpus", 3)
syncCfg()
toTitle()
