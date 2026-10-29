// Bomber Blitz for the ElecFreaks Retro Arcade (MakeCode Arcade).
// data.ts — every tunable number in the game lives here, so it is the
// best file to experiment with first: change a value, press Download, play.

// ---------------------------------------------------------------- screen + timing
const T = 8                 // one map tile is 8x8 pixels
const HUD = 16              // status bar height at the top of the screen
const SCREEN_W = 160
const SCREEN_H = 120
const STEP = 1 / 30         // the game logic runs 30 times per second

// ---------------------------------------------------------------- bombs + movement (in tiles and seconds)
const BOMB_FUSE = 2.4
const FLAME_T = 0.55
const BURN_T = 0.5
const BASE_SPEED = 3.0
const SPEED_STEP = 0.55
const MAX_SPEED = 5.2
const MAX_STAGE = 50

// directions: 0 up, 1 right, 2 down, 3 left
const DX = [0, 1, 0, -1]
const DY = [-1, 0, 1, 0]

// ---------------------------------------------------------------- map cells
const CELL_FLOOR = 0
const CELL_HARD = 1
const CELL_BRICK = 2
const CELL_BURNING = 3

// ---------------------------------------------------------------- items
const IT_NONE = 0
const IT_EXIT = 1
const IT_BOMB = 2
const IT_FIRE = 3
const IT_SPEED = 4
const IT_KICK = 5
const IT_REMOTE = 6
const IT_WALLPASS = 7
const IT_BOMBPASS = 8
const IT_FLAMEPASS = 9
const IT_VEST = 10
const IT_HEART = 11
const ITEM_NAME = ["", "EXIT", "BOMB UP", "FIRE UP", "SPEED UP", "KICK", "DETONATOR",
    "WALL PASS", "BOMB PASS", "FLAME PASS", "INVINCIBLE", "1UP"]
// the guaranteed power-up hidden on each story stage, repeating every 20 stages
const STAGE_ITEMS = [IT_FIRE, IT_BOMB, IT_SPEED, IT_REMOTE, IT_BOMB, IT_FIRE, IT_KICK, IT_BOMBPASS, IT_FIRE, IT_WALLPASS,
    IT_BOMB, IT_FLAMEPASS, IT_SPEED, IT_FIRE, IT_HEART, IT_VEST, IT_BOMB, IT_KICK, IT_FIRE, IT_REMOTE]

// ---------------------------------------------------------------- enemies
// index:            0 balloom 1 oneal 2 doll 3 minvo 4 kondoria 5 ovapi 6 pass 7 pontan
const EN_NAME = ["BALLOOM", "ONEAL", "DOLL", "MINVO", "KONDORIA", "OVAPI", "PASS", "PONTAN"]
const EN_SPEED = [1.5, 2.2, 2.2, 3.0, 1.1, 1.8, 3.2, 3.6]
const AI_RANDOM = 0
const AI_CHASE = 1
const AI_SMART = 2
const EN_AI = [AI_RANDOM, AI_CHASE, AI_RANDOM, AI_CHASE, AI_CHASE, AI_RANDOM, AI_SMART, AI_SMART]
const EN_CHASE = [0, 0.45, 0, 0.6, 0.7, 0, 0, 0]      // chance a chaser turns toward you
const EN_PTS = [100, 200, 400, 800, 1000, 2000, 4000, 8000]
const EN_COLOR = [4, 8, 3, 5, 9, 10, 2, 1]             // palette colours (see pxt.json)
const EN_SHAPE = [0, 1, 2, 1, 3, 3, 0, 2]
const EN_WALL = [false, false, false, false, true, true, false, true]  // can float through bricks
const PONTAN = 7

// stages 1-10 have hand-made enemy lists: pairs of [enemy type, count]
const FIXED_STAGES = [
    [0, 6],
    [0, 3, 1, 3],
    [0, 2, 1, 2, 2, 2],
    [0, 1, 1, 1, 2, 2, 3, 2],
    [1, 4, 2, 3],
    [1, 2, 2, 3, 3, 2],
    [1, 2, 2, 3, 4, 2],
    [1, 1, 2, 2, 3, 4],
    [1, 1, 2, 1, 3, 4, 4, 1],
    [1, 1, 2, 1, 3, 1, 4, 1, 5, 1, 6, 1]
]

// ---------------------------------------------------------------- bomber colours (palette indices)
// each row: head, head shade, body, hands+feet
const BOMBER_PAL = [
    [1, 13, 8, 2],     // P1 white
    [14, 15, 15, 5],   // P2 black
    [2, 12, 12, 1],    // P3 red
    [5, 4, 4, 8]       // P4 yellow
]
const BOMBER_LABEL = ["P1", "P2", "P3", "P4"]

// ---------------------------------------------------------------- music (MIDI note numbers, 0 = rest)
const LEAD = [76, 0, 79, 0, 81, 0, 79, 76, 74, 0, 76, 0, 72, 0, 0, 0,
    76, 0, 79, 0, 81, 0, 84, 81, 79, 0, 81, 0, 79, 76, 0, 0,
    72, 0, 74, 0, 76, 0, 79, 0, 81, 0, 79, 0, 76, 0, 74, 0,
    72, 0, 76, 74, 72, 0, 69, 0, 72, 0, 0, 0, 67, 0, 71, 0]
const BASS = [48, 48, 53, 55, 48, 48, 53, 55, 45, 45, 53, 55, 48, 48, 55, 43]
