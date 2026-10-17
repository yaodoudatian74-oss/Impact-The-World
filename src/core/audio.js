// Tiny WebAudio synth: sound effects and a gentle generative background tune per realm.
// The context starts on the first user gesture (browsers block autoplay before that).

export class Audio {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.bgmOn = true;
    this.bgm = null;
    this.lastPlay = {};
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.7;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.22;
      this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0, bus } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  hiss(dur, { vol = 0.2, freq = 1200, q = 1, delay = 0 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.sfxBus);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  play(name) {
    if (!this.ctx || !this.sfxOn) return;
    const now = performance.now();
    if (now - (this.lastPlay[name] || 0) < 45) return;
    this.lastPlay[name] = now;
    switch (name) {
      case 'slash': this.hiss(0.12, { vol: 0.25, freq: 2400, q: 0.8 }); break;
      case 'hit': this.tone(180, 0.08, { type: 'square', vol: 0.12, slide: -80 }); this.hiss(0.06, { vol: 0.15, freq: 900 }); break;
      case 'crit': this.tone(520, 0.12, { type: 'triangle', vol: 0.18, slide: 300 }); this.hiss(0.08, { vol: 0.2, freq: 3000 }); break;
      case 'shoot': this.tone(700, 0.1, { type: 'triangle', vol: 0.12, slide: -400 }); break;
      case 'magic': this.tone(880, 0.25, { type: 'sine', vol: 0.12, slide: 440 }); this.tone(1320, 0.2, { vol: 0.06, delay: 0.05 }); break;
      case 'skill': this.tone(440, 0.3, { type: 'sawtooth', vol: 0.08, slide: 660 }); this.hiss(0.3, { vol: 0.15, freq: 1800 }); break;
      case 'burst': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, { type: 'triangle', vol: 0.12, delay: i * 0.06 })); this.hiss(0.8, { vol: 0.25, freq: 600, q: 0.5 }); break;
      case 'boom': this.tone(90, 0.5, { type: 'sine', vol: 0.4, slide: -50 }); this.hiss(0.5, { vol: 0.3, freq: 300, q: 0.6 }); break;
      case 'reaction': this.tone(660, 0.15, { type: 'square', vol: 0.08 }); this.tone(990, 0.2, { type: 'triangle', vol: 0.1, delay: 0.05 }); break;
      case 'jump': this.tone(300, 0.12, { type: 'sine', vol: 0.1, slide: 200 }); break;
      case 'dash': this.hiss(0.2, { vol: 0.2, freq: 1400, q: 0.6 }); break;
      case 'hurt': this.tone(140, 0.2, { type: 'sawtooth', vol: 0.12, slide: -60 }); break;
      case 'heal': [660, 880, 1100].forEach((f, i) => this.tone(f, 0.3, { vol: 0.08, delay: i * 0.07 })); break;
      case 'chest': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.1, delay: i * 0.08 })); break;
      case 'pickup': this.tone(988, 0.15, { type: 'sine', vol: 0.12 }); this.tone(1319, 0.2, { vol: 0.1, delay: 0.07 }); break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.4, { type: 'square', vol: 0.06, delay: i * 0.1 })); break;
      case 'ui': this.tone(880, 0.06, { type: 'sine', vol: 0.08 }); break;
      case 'warp': this.tone(220, 0.8, { type: 'sine', vol: 0.15, slide: 880 }); this.hiss(0.8, { vol: 0.12, freq: 2000 }); break;
      case 'switch': this.tone(600, 0.1, { vol: 0.1, slide: 300 }); break;
      case 'reward': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.6, { type: 'triangle', vol: 0.12, delay: i * 0.12 })); break;
      case 'quest': [659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.1, delay: i * 0.09 })); break;
      default: break;
    }
  }

  // Generative pentatonic-style loop. realmBgm: { root, scale, tempo }
  startMusic(realmBgm) {
    this.stopMusic();
    if (!this.ctx || !this.bgmOn) return;
    const { root, scale, tempo } = realmBgm;
    const beat = 60 / tempo;
    const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
    let step = 0;
    let seed = root * 97;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const prog = [0, 3, 4, 2];
    const tick = () => {
      if (!this.ctx || !this.bgmOn) return;
      const bar = Math.floor(step / 8) % prog.length;
      const deg = prog[bar];
      const chordRoot = root - 12 + scale[deg % scale.length];
      if (step % 8 === 0) {
        [0, 7, 12].forEach((iv) => this.tone(midi(chordRoot + iv), beat * 7.5, { type: 'sine', vol: 0.05, bus: this.musicBus }));
      }
      if (rand() < 0.62) {
        const n = scale[Math.floor(rand() * scale.length)] + root + (rand() < 0.3 ? 12 : 0);
        this.tone(midi(n), beat * (rand() < 0.3 ? 1.8 : 0.9), { type: 'triangle', vol: 0.045, bus: this.musicBus });
      }
      step++;
    };
    this.bgm = setInterval(tick, beat * 1000);
  }

  stopMusic() {
    if (this.bgm) clearInterval(this.bgm);
    this.bgm = null;
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
}
