// Sound only: tiny synthesised beeps through the Web Audio API, no
// audio files. The context is created on the first user gesture (a
// browser only lets sound start after one), and every call is safe to
// make before that: it simply does nothing.

let context = null;

function audio() {
  if (context !== null) return context;
  try {
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
  } catch {
    return null;
  }
  return context;
}

/** One short tone: frequency, how long, how loud, and its shape. */
function tone(freq, seconds, gain, type) {
  const ctx = audio();
  if (ctx === null) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  } catch {
    // Sound is decoration: a failure here never stops the game.
  }
}

export function createSound() {
  return {
    /** Warm up the context on a gesture, so the first real sound plays. */
    unlock() {
      audio();
    },
    /** A coin tossed: a bright clink. */
    coin() {
      tone(1320, 0.12, 0.12, 'sine');
      tone(1760, 0.1, 0.08, 'sine');
    },
    /** The diamond lifted: three rising notes. */
    loot() {
      tone(523, 0.12, 0.14, 'triangle');
      setTimeout(() => tone(659, 0.12, 0.14, 'triangle'), 90);
      setTimeout(() => tone(784, 0.2, 0.14, 'triangle'), 180);
    },
    /** Spotted: a short harsh buzz. */
    spotted() {
      tone(220, 0.18, 0.14, 'sawtooth');
    },
    /** Caught: a low fall. */
    caught() {
      tone(330, 0.25, 0.16, 'sawtooth');
      setTimeout(() => tone(165, 0.4, 0.16, 'sawtooth'), 160);
    },
    /** Clean getaway: a little fanfare. */
    win() {
      tone(523, 0.14, 0.14, 'triangle');
      setTimeout(() => tone(659, 0.14, 0.14, 'triangle'), 110);
      setTimeout(() => tone(784, 0.14, 0.14, 'triangle'), 220);
      setTimeout(() => tone(1047, 0.3, 0.14, 'triangle'), 330);
    },
  };
}
