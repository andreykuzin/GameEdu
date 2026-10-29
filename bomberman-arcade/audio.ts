// audio.ts — sound effects and the chiptune, built from MakeCode sound effects.
// A sound effect is one "voice": a wave shape sliding from a start frequency
// to an end frequency while its volume fades out.

let musicOn = true
let musicPlaying = false
let musicTempo = 148
let musicStep = 0
let musicNext = 0
let sfxMuted = false          // the title-screen demo plays silently

class QueuedTone {
    constructor(public at: number, public sound: music.Playable) { }
}
let toneQueue: QueuedTone[] = []

function midiHz(n: number): number {
    return 440 * Math.pow(2, (n - 69) / 12)
}

function voice(wave: WaveShape, freq: number, ms: number, vol: number, slide: number): music.Playable {
    const end = Math.max(30, freq * slide)
    return music.createSoundEffect(wave, freq, end, vol, 0, ms, SoundExpressionEffect.None, InterpolationCurve.Logarithmic)
}

// play a tone now, or `delay` milliseconds from now
function tone(freq: number, ms: number, wave: WaveShape, vol: number, slide: number, delay: number) {
    const s = voice(wave, freq, ms, vol, slide)
    if (delay <= 0) music.play(s, music.PlaybackMode.InBackground)
    else toneQueue.push(new QueuedTone(game.runtime() + delay, s))
}

function arpeggio(freqs: number[], ms: number, gap: number, vol: number) {
    for (let i = 0; i < freqs.length; i++) {
        if (freqs[i] > 0) tone(freqs[i], ms, WaveShape.Square, vol, 1, i * gap)
    }
}

function sfx(name: string) {
    if (sfxMuted) return
    if (name == "place") tone(330, 70, WaveShape.Square, 120, 0.6, 0)
    else if (name == "boom") {
        tone(2400, 500, WaveShape.Noise, 255, 0.05, 0)
        tone(90, 350, WaveShape.Triangle, 255, 0.4, 0)
    }
    else if (name == "item") arpeggio([660, 880, 1320], 80, 60, 110)
    else if (name == "enemy") tone(900, 180, WaveShape.Square, 110, 0.3, 0)
    else if (name == "die") arpeggio([523, 392, 330, 262, 196], 140, 120, 130)
    else if (name == "kick") tone(200, 80, WaveShape.Triangle, 200, 1.8, 0)
    else if (name == "exit") arpeggio([523, 659, 784, 1047], 120, 80, 120)
    else if (name == "clear") arpeggio([523, 523, 659, 784, 659, 784, 1047], 160, 130, 120)
    else if (name == "thud") tone(600, 150, WaveShape.Noise, 200, 0.2, 0)
    else if (name == "hurry") arpeggio([880, 0, 880, 0, 880], 100, 100, 120)
    else if (name == "spawn") tone(160, 400, WaveShape.Sawtooth, 120, 3, 0)
    else if (name == "start") arpeggio([392, 523, 659, 784], 100, 70, 100)
    else if (name == "menu") tone(660, 40, WaveShape.Square, 80, 1, 0)
}

function musicStart() {
    if (musicPlaying) return
    musicPlaying = true
    musicStep = 0
    musicNext = game.runtime() + 80
}
function musicStop() {
    musicPlaying = false
}

// called every frame: plays queued sfx and the next sixteenth-notes of music
function audioTick(paused: boolean) {
    const now = game.runtime()
    for (let i = toneQueue.length - 1; i >= 0; i--) {
        if (toneQueue[i].at <= now) {
            music.play(toneQueue[i].sound, music.PlaybackMode.InBackground)
            toneQueue.removeAt(i)
        }
    }
    if (!musicPlaying) return
    const stepMs = 60000 / musicTempo / 4
    if (musicNext < now - 500) musicNext = now      // we fell behind (e.g. a slow frame): skip ahead
    while (musicNext <= now + 30) {
        if (musicOn && !paused) playMusicStep(musicStep, stepMs)
        musicNext += stepMs
        musicStep = (musicStep + 1) % 64
    }
}

function playMusicStep(s: number, stepMs: number) {
    const n = LEAD[s]
    if (n) music.play(voice(WaveShape.Square, midiHz(n), stepMs * 1.6, 45, 1), music.PlaybackMode.InBackground)
    if (s % 2 == 0) {
        const root = BASS[s >> 2] + (s % 4 ? 12 : 0)
        music.play(voice(WaveShape.Triangle, midiHz(root), stepMs * 1.8, 140, 1), music.PlaybackMode.InBackground)
    }
    if (s % 8 == 0) music.play(voice(WaveShape.Sine, 120, 120, 200, 0.4), music.PlaybackMode.InBackground)
}
