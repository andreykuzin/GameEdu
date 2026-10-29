# Bomber Blitz for the Retro Arcade

A MakeCode Arcade port of [Bomber Blitz](https://github.com/andreykuzin/GameEdu/tree/main/bomberman), part of [GameEdu](https://github.com/andreykuzin/GameEdu), for the ElecFreaks **Retro Arcade for Education (EF08247)**. It is written in MakeCode's TypeScript (JavaScript) so students can read it, change it and play their changes on the real device.

## What's in the game

- **Story**: 50 stages on scrolling 31×13 maps, 8 enemy types, the exit and power-ups hidden under bricks, Pontans when time runs out, and bombing the exit releases tougher enemies.
- **Battle**: 2–4 bombers (you plus up to 3 CPU rivals), first to 3 round wins, and sudden-death blocks falling in the last 50 seconds.
- **Power-ups**: bomb up, fire up, speed, kick, detonator, wall pass, bomb pass, flame pass, invincibility and 1UP.
- Chain-combo scores, corner-sliding movement, chiptune music, and a saved high score.

## Controls

| Button | In game | In menus |
|---|---|---|
| D-pad | move | choose / change values |
| A | drop a bomb | select |
| B | detonate (after picking up DETONATOR) | back |
| MENU | pause (music on/off, restart, quit) | |

In the browser simulator: arrow keys move, **Z** = A, **X** = B, **`** (backtick) = MENU.

## Put it on your Retro Arcade

1. Open [arcade.makecode.com](https://arcade.makecode.com), choose **Import → Import URL**, and paste `https://github.com/andreykuzin/bomber-blitz-arcade`.
2. Connect the Retro to your computer with a USB-C cable.
3. In MakeCode, click the **…** next to Download, choose **Choose hardware**, and pick **Retro Arcade for Education** (the "F4" board).
4. Press the Retro's reset button once to show its download screen.
5. Click **Download**. The first time, pair the device when Chrome asks ("Arcade"). The game is copied to the Retro.
6. Unplug the cable and play.

These are the steps from ElecFreaks' [program download guide](https://wiki.elecfreaks.com/en/retroarcade/program-download-method/).

## How the code is organised

Read the files in this order. Each one is about a single idea.

| File | What it teaches |
|---|---|
| `data.ts` | Every number that tunes the game: speeds, fuse time, enemy stats, stage lists. **Start experimenting here.** |
| `art.ts` | Pixel art as image literals, plus recolouring one sprite for four players. |
| `audio.ts` | Building sound effects and a looping chiptune from simple wave shapes. |
| `world.ts` | The map grid, the game objects (classes), the rules: bombs, chain reactions, power-ups, scoring. |
| `ai.ts` | Enemy behaviour, breadth-first search path-finding, and the CPU bomber's "danger map". |
| `render.ts` | Drawing a frame: tiles, sprites, the scrolling camera, and the status bar. |
| `main.ts` | Menus, buttons, saved high scores, and the fixed-time-step game loop. |

### Ideas to try

1. In `data.ts`, change `BOMB_FUSE` to `1` or `BASE_SPEED` to `5`. How does the game feel?
2. In `art.ts`, repaint `BRICK_IMG` or a bomber, or add a fifth bomber colour to `BOMBER_PAL`.
3. Add a new enemy: add an entry to every `EN_*` list in `data.ts`, then use it in `FIXED_STAGES`.
4. Add a new power-up: add an `IT_*` value, an icon in `ICONS`, and a case in `applyItem` (`world.ts`).
5. In `ai.ts`, make CPU bombers braver or more careful by changing the safety margins in `aiPlan`.

## Building from the command line (optional)

```bash
npm install -g pxt
pxt target arcade
pxt install
pxt build                      # compile and type-check for the simulator
pxt build --hw stm32f401       # firmware for the Retro Arcade: built/binary.uf2
```

The last command adds a hardware dependency to `pxt.json`. Remove it before committing, so the project still lets you choose any hardware in the MakeCode editor.

## Differences from the browser version

- The screen is 160×120, so tiles are 8 pixels instead of 16. The whole 15×13 battle arena fits on screen.
- There are no touch or full-screen controls: the Retro has real buttons.
- Two-player battle uses MakeCode's player 2 controls (two linked consoles, or the second keyboard layout in the simulator).
- The logic runs at 30 steps per second, a good fit for the device's processor.
