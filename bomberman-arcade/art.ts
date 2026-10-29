// art.ts — pixel art. Every picture is an 8x8 (or 6x6) image literal.
// Each character is one pixel; the digits and letters are palette colours
// (open pxt.json to see them): . clear  1 white  2 red  3 pink  4 orange
// 5 yellow  6 grass  7 dark grass  8 blue  9 cyan  a purple  b brick
// c dark brown  d grey  e dark grey  f black.
// Tip: in the MakeCode editor you can click an image to paint it.

const HARD_IMG = img`
    1 1 1 1 1 1 1 d
    1 d d d d d d e
    1 d 1 1 1 d d e
    1 d 1 d d e d e
    1 d 1 d d e d e
    1 d d e e e d e
    1 d d d d d d e
    d e e e e e e e
`
const BRICK_IMG = img`
    b b b c b b b b
    b b b c b b b b
    b b b c b b b b
    c c c c c c c c
    b b b b b b b c
    b b b b b b b c
    b b b b b b b c
    c c c c c c c c
`
// bombs pulse between a small and a big frame
const BOMB_IMGS = [img`
    . . . . . . . .
    . . . . . c . .
    . . f f f f . .
    . f 1 f f f f .
    . f f f f f f .
    . f f f f f f .
    . f f f f f f .
    . . f f f f . .
`, img`
    . . . . . . c .
    . . . . . c . .
    . f f f f f f .
    f 1 f f f f f f
    f f f f f f f f
    f f f f f f f f
    f f f f f f f f
    . f f f f f f .
`]

// 6x6 power-up icons, indexed by item type (IT_BOMB = 2 ... IT_HEART = 11)
const ICONS: Image[] = [null, null, img`
    . . . . 5 .
    . . f f . .
    . f 1 f f .
    . f f f f .
    . f f f f .
    . . f f . .
`, img`
    . . 4 . . .
    . . 4 4 . .
    . 4 5 4 4 .
    . 4 5 5 4 .
    4 5 1 5 5 4
    . 4 4 4 4 .
`, img`
    . 1 1 . . .
    . 1 1 8 . .
    . 1 1 1 1 .
    1 1 1 1 1 1
    5 5 5 5 5 5
    . f . . f .
`, img`
    . 4 4 . . .
    . 4 4 . . .
    . 4 4 4 . .
    . 4 4 4 4 4
    f f f f f f
    . . . . . .
`, img`
    . . . . f .
    . . . f . .
    . d d d d .
    . d 2 2 d .
    . d d d d .
    . d f f d .
`, img`
    . 1 1 1 1 .
    1 1 1 1 1 1
    1 f 1 1 f 1
    1 1 1 1 1 1
    1 1 1 1 1 1
    1 . 1 1 . 1
`, img`
    . . . . 5 .
    . . d d . .
    . d 1 d d .
    . d d d d .
    . d d d d .
    . . d d . .
`, img`
    9 9 9 9 9 9
    9 1 4 4 1 9
    9 4 5 5 4 9
    9 1 4 4 1 9
    . 9 1 1 9 .
    . . 9 9 . .
`, img`
    . . 5 5 . .
    5 5 5 5 5 5
    . 5 5 5 5 .
    . 5 5 5 5 .
    . 5 . . 5 .
    5 . . . . 5
`, img`
    . 2 . . 2 .
    2 2 2 2 2 2
    2 2 2 2 2 2
    . 2 2 2 2 .
    . . 2 2 . .
    . . . . . .
`]

// ---------------------------------------------------------------- bombers
// Drawn once in "template" colours (1 head, d head shade, 8 body, 2 hands+feet,
// 3 face, f eyes) and recoloured for each player when the game starts.
const BOMBER_DOWN = img`
    . . . 2 2 . . .
    . 1 1 1 1 1 1 .
    1 3 3 3 3 3 3 1
    1 3 f 3 3 f 3 1
    . d d d d d d .
    2 . 8 8 8 8 . 2
    . . 8 8 8 8 . .
    . 2 2 . . 2 2 .
`
const BOMBER_UP = img`
    . . . 2 2 . . .
    . 1 1 1 1 1 1 .
    1 1 1 1 1 1 1 1
    1 1 1 1 1 1 1 1
    . d d d d d d .
    2 . 8 8 8 8 . 2
    . . 8 8 8 8 . .
    . 2 2 . . 2 2 .
`
const BOMBER_RIGHT = img`
    . . . 2 2 . . .
    . 1 1 1 1 1 1 .
    1 1 1 3 3 3 3 1
    1 1 1 3 3 f 3 1
    . d d d d d d .
    . 2 8 8 8 8 . .
    . . 8 8 8 8 2 .
    . . 2 2 . 2 2 .
`

// ---------------------------------------------------------------- enemies
// Four body shapes, drawn in colour 9 and recoloured per enemy type.
const ENEMY_SHAPES = [img`
    . . 9 9 9 9 . .
    . 9 9 9 9 9 9 .
    9 9 9 9 9 9 9 9
    9 1 1 9 9 1 1 9
    9 1 1 9 9 1 1 9
    9 9 9 9 9 9 9 9
    . 9 9 9 9 9 9 .
    . . 9 9 9 9 . .
`, img`
    . 9 9 9 9 9 9 .
    9 9 9 9 9 9 9 9
    9 1 1 9 9 1 1 9
    9 1 1 9 9 1 1 9
    9 9 9 9 9 9 9 9
    9 9 f f f f 9 9
    9 9 9 9 9 9 9 9
    . 9 9 . . 9 9 .
`, img`
    . . . 9 9 . . .
    . . 9 9 9 9 . .
    . 9 9 9 9 9 9 .
    9 9 9 9 9 9 9 9
    9 1 1 9 9 1 1 9
    9 1 1 9 9 1 1 9
    9 9 9 9 9 9 9 9
    . 9 9 9 9 9 9 .
`, img`
    . . 9 9 9 9 . .
    . 9 9 9 9 9 9 .
    9 9 9 9 9 9 9 9
    9 1 1 9 9 1 1 9
    9 1 1 9 9 1 1 9
    9 9 9 9 9 9 9 9
    9 9 9 9 9 9 9 9
    9 . 9 . 9 . 9 .
`]
const EYE_Y = [3, 2, 4, 3]   // top row of the eyes in each shape

// ---------------------------------------------------------------- recolouring
// recolor(img, [from, to, from, to, ...]) returns a copy with colours swapped
// in a single pass, so swapping 1->2 and 2->1 at the same time works.
function recolor(src: Image, swaps: number[]): Image {
    const out = src.clone()
    for (let y = 0; y < src.height; y++) {
        for (let x = 0; x < src.width; x++) {
            const c = src.getPixel(x, y)
            for (let k = 0; k < swaps.length; k += 2) {
                if (swaps[k] == c) { out.setPixel(x, y, swaps[k + 1]); break }
            }
        }
    }
    return out
}

// walking frame: the same pose with the feet stepping and hands swinging
function stepFrame(src: Image, foot: number): Image {
    const out = src.clone()
    for (let x = 0; x < 8; x++) out.setPixel(x, 7, 0)
    out.setPixel(1, 7, foot); out.setPixel(2, 7, foot)
    out.setPixel(6, 6, foot); out.setPixel(6, 7, foot)
    return out
}

// bomberSprites[player][face][frame], face: 0 up 1 right 2 down 3 left
let bomberSprites: Image[][][] = []
let bomberFlash: Image[] = []
function buildBomberSprites() {
    const left = BOMBER_RIGHT.clone()
    left.flipX()
    const poses = [BOMBER_UP, BOMBER_RIGHT, BOMBER_DOWN, left]
    bomberSprites = []
    for (let p = 0; p < 4; p++) {
        const pal = BOMBER_PAL[p]
        const swaps = [1, pal[0], 13, pal[1], 8, pal[2], 2, pal[3]]
        const faces: Image[][] = []
        for (let f = 0; f < 4; f++) {
            const still = recolor(poses[f], swaps)
            faces.push([still, stepFrame(still, pal[3])])
        }
        bomberSprites.push(faces)
    }
    // the white/orange flash used while a bomber is caught in a blast
    bomberFlash = []
    for (let f = 0; f < 4; f++) bomberFlash.push(recolor(poses[f], [1, 1, 13, 5, 8, 4, 2, 5]))
}

// enemySprites[type][0 normal | 1 second frame], enemyWhite[type] for the hit flash
let enemySprites: Image[][] = []
let enemyWhite: Image[] = []
let enemyBurn: Image[] = []
function buildEnemySprites() {
    for (let t = 0; t < EN_COLOR.length; t++) {
        const base = recolor(ENEMY_SHAPES[EN_SHAPE[t]], [9, EN_COLOR[t]])
        const alt = base.clone()
        if (EN_SHAPE[t] == 3) {
            // ghosts wiggle their skirt
            for (let x = 0; x < 8; x++) alt.setPixel(x, 7, x % 2 ? EN_COLOR[t] : 0)
        } else {
            // everyone else bobs: shift the picture up one pixel
            alt.fill(0)
            alt.drawTransparentImage(base, 0, -1)
        }
        enemySprites.push([base, alt])
        enemyWhite.push(recolor(ENEMY_SHAPES[EN_SHAPE[t]], [9, 1, 1, 13]))
        enemyBurn.push(recolor(ENEMY_SHAPES[EN_SHAPE[t]], [9, 4, 1, 5]))
    }
}
