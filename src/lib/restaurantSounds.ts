let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

export function playAlert(type: 'kitchen_new' | 'reception_ready' | 'waiter_ready') {
  if (localStorage.getItem('duka_sound_muted') === '1') return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const freqs =
      type === 'kitchen_new'
        ? [880, 660, 880]
        : type === 'reception_ready'
          ? [523, 784, 1047]
          : [440, 554];
    let t = ctx.currentTime;
    freqs.forEach(f => {
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      t += 0.28;
    });
    osc.start(ctx.currentTime);
    osc.stop(t);
  } catch {
    /* browser autoplay policy */
  }
}

export function toggleSoundMute(): boolean {
  const muted = localStorage.getItem('duka_sound_muted') === '1';
  localStorage.setItem('duka_sound_muted', muted ? '0' : '1');
  return !muted;
}

export function isSoundMuted(): boolean {
  return localStorage.getItem('duka_sound_muted') === '1';
}
