# GameEdu

Retro arcade games that run in any browser, for use on school arcade machines and devices.

## Bomber Blitz

`bomberman/index.html` is a playable, single-file remake of 8-bit Bomberman with some improvements. Open it in any browser; it needs no build step.

- **Story**: 50 stages on scrolling 31×13 maps. 8 enemy types, from slow balloons to wall-walking hunters. The exit and power-ups are hidden under bricks. Bombing the exit releases tougher enemies, and running out of time sends in Pontans.
- **Battle**: 2–4 bombers on one screen, with local 2-player play and CPU opponents. First to 3 round wins takes the match, and sudden-death blocks start falling when 50 seconds are left.
- **Power-ups**: bomb up, fire up, speed, kick, detonator, wall pass, bomb pass, flame pass, invincibility and 1UP.
- **Improvements over the NES original**: corner-sliding movement assist, bomb kicking, chain-combo score multipliers, time bonus and continues, CPU rivals, chiptune music and sound effects, gamepad support, touch controls on phones, and a saved high score.
- **Full screen mode**: the FULL button (touch bar, title screen or pause menu) fills the screen and switches to big thumb zones, with a floating d-pad on the left and a bomb button on the right. Tall screens such as a Fold cover screen get the zones below the game; wide screens get them beside it.

Controls: arrows/WASD to move, Space/Z to drop a bomb, X to detonate, P to pause, M to toggle music. In 2-player battle, P1 uses WASD + Space and P2 uses the arrows + Enter.

## Bomber Blitz for the Retro Arcade

`bomberman-arcade/` is the same game rewritten in MakeCode Arcade for the ElecFreaks Retro Arcade for Education (EF08247). It's split into small, commented files so students can learn game development by changing it and playing the result on the device. See [bomberman-arcade/README.md](bomberman-arcade/README.md) for how to load it and a list of things to try.
