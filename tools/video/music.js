/*
 * Musique d'accompagnement synthétisée ici même (aucun échantillon, aucune œuvre existante) :
 * nappe douce, basse, arpège léger et quelques bruitages (clics, souffles, carillon final)
 * calés sur les événements de la vidéo. Le résultat est déterministe (bruit à graine fixe).
 *
 *   writeMusic(fichier.wav, durée en s, [{ t, type: 'click'|'whoosh'|'sweep'|'pop'|'chime' }])
 */
'use strict';
const fs = require('fs');

const SR = 48000;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const CHORDS = [
  [50, 57, 61, 64, 66],   // Ré maj9
  [47, 54, 57, 61, 62],   // Si m9
  [43, 50, 54, 57, 59],   // Sol maj9
  [45, 52, 54, 59, 62]    // La 6 sus
];
const BEAT = 0.6, BAR = 4 * BEAT;   // 100 battements par minute

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 * 2 - 1; }; }

function reverb(inp) {
  // réverbération de Schroeder (4 filtres en peigne + 2 passe-tout), en mono
  const out = new Float32Array(inp.length);
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ d: Math.round(d * SR / 44100), b: new Float32Array(Math.round(d * SR / 44100)), i: 0, f: 0 }));
  for (let n = 0; n < inp.length; n++) {
    let s = 0;
    for (const c of combs) {
      const y = c.b[c.i];
      c.f = y * 0.75 + c.f * 0.25;
      c.b[c.i] = inp[n] + c.f * 0.82;
      c.i = (c.i + 1) % c.d;
      s += y;
    }
    out[n] = s * 0.25;
  }
  for (const d0 of [225, 556]) {
    const d = Math.round(d0 * SR / 44100), b = new Float32Array(d);
    let i = 0;
    for (let n = 0; n < out.length; n++) {
      const bo = b[i], x = out[n];
      const y = -x + bo;
      b[i] = x + bo * 0.5;
      out[n] = y;
      i = (i + 1) % d;
    }
  }
  return out;
}

function render(dur, events) {
  const N = Math.ceil(dur * SR);
  const L = new Float32Array(N), R = new Float32Array(N), send = new Float32Array(N);
  const noise = rng(20261126);
  const chordAt = (t) => CHORDS[Math.floor(t / BAR) % CHORDS.length];

  // nappe : harmoniques douces, trois voix légèrement désaccordées, fondu entre accords
  const det = [-0.11, 0, 0.12];
  for (let n = 0; n < N; n++) {
    const t = n / SR;
    const bi = Math.floor(t / BAR), into = t - bi * BAR;
    const xf = Math.min(1, into / 0.7);
    const cur = CHORDS[bi % 4], prev = CHORDS[(bi + 3) % 4];
    let s = 0;
    for (const [ch, g] of [[cur, xf], [prev, bi > 0 ? 1 - xf : 0]]) {
      if (g <= 0) continue;
      for (let k = 0; k < ch.length; k++) {
        const f = mtof(ch[k] + 12 * (k === 0 ? 0 : 0));
        for (let v = 0; v < 3; v++) {
          const ph = 2 * Math.PI * f * Math.pow(2, det[v] / 12) * t + k * 1.3 + v * 2.1;
          s += g * (Math.sin(ph) + 0.32 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph) + 0.05 * Math.sin(4 * ph)) / 3;
        }
      }
    }
    const lfo = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.11 * t);
    const v = s * 0.028 * lfo;
    L[n] += v * (0.9 + 0.1 * Math.sin(t * 0.7));
    R[n] += v * (0.9 + 0.1 * Math.cos(t * 0.7));
    send[n] += v * 0.5;
  }

  const add = (start, len, fn, pan = 0, rev = 0.3) => {
    const a = Math.max(0, Math.floor(start * SR)), b = Math.min(N, Math.floor((start + len) * SR));
    for (let n = a; n < b; n++) {
      const v = fn((n - a) / SR);
      L[n] += v * (1 - pan) ; R[n] += v * (1 + pan);
      send[n] += v * rev;
    }
  };

  // basse : temps 1 et 3, à partir de la deuxième mesure
  for (let t = BAR; t < dur; t += 2 * BEAT) {
    const f = mtof(chordAt(t)[0] - 12);
    add(t, 1.1, (x) => (Math.sin(2 * Math.PI * f * x) + 0.25 * Math.sin(4 * Math.PI * f * x)) * Math.min(1, x / 0.012) * Math.exp(-x * 2.6) * 0.11, 0, 0.05);
  }
  // arpège : croches, notes de l'accord une octave au-dessus
  const PAT = [0, 2, 4, 3, 1, 3, 4, 2];
  let k = 0;
  for (let t = BAR; t < dur - 0.4; t += BEAT / 2, k++) {
    const ch = chordAt(t);
    const f = mtof(ch[PAT[k % 8]] + 12);
    const acc = k % 2 === 0 ? 1 : 0.7;
    add(t, 0.6, (x) => (Math.sin(2 * Math.PI * f * x) + 0.3 * Math.sin(4 * Math.PI * f * x) * Math.exp(-x * 9)) * Math.min(1, x / 0.004) * Math.exp(-x * 7) * 0.05 * acc, (k % 4 - 1.5) * 0.25, 0.6);
  }
  // charleston doux sur les contretemps, à partir de la troisième mesure
  for (let t = 2 * BAR + BEAT / 2; t < dur - 0.6; t += BEAT) {
    let last = 0;
    add(t, 0.08, (x) => { const w = noise(); const hp = w - last; last = w; return hp * Math.exp(-x * 60) * 0.022; }, 0.3, 0.1);
  }
  // pulsation grave très légère
  for (let t = 2 * BAR; t < dur - 1; t += 2 * BEAT) {
    add(t, 0.3, (x) => Math.sin(2 * Math.PI * (48 + 70 * Math.exp(-x * 30)) * x) * Math.exp(-x * 12) * 0.12, 0, 0);
  }

  // bruitages
  for (const e of events) {
    if (e.type === 'click') {
      add(e.t, 0.05, (x) => (Math.sin(2 * Math.PI * 1800 * x) * 0.6 + noise() * 0.25) * Math.exp(-x * 160) * 0.14, 0, 0.1);
    } else if (e.type === 'whoosh') {
      let lp = 0;
      const len = 0.7;
      add(e.t - 0.25, len, (x) => { const c = 0.01 + 0.06 * Math.sin(Math.PI * x / len); lp += c * (noise() - lp); return lp * Math.pow(Math.sin(Math.PI * x / len), 2) * 0.32; }, 0, 0.4);
    } else if (e.type === 'sweep') {
      add(e.t, 1.3, (x) => { const f = 600 + 1400 * x; return Math.sin(2 * Math.PI * f * x) * Math.sin(Math.PI * x / 1.3) * 0.028; }, 0, 0.8);
    } else if (e.type === 'pop') {
      add(e.t, 0.15, (x) => Math.sin(2 * Math.PI * (880 + 600 * x) * x) * Math.min(1, x / 0.003) * Math.exp(-x * 30) * 0.07, 0, 0.5);
    } else if (e.type === 'chime') {
      [74, 78, 81, 86].forEach((m, i) => {
        const f = mtof(m);
        add(e.t + i * 0.09, 2.4, (x) => (Math.sin(2 * Math.PI * f * x) + 0.2 * Math.sin(2 * Math.PI * f * 2.76 * x) * Math.exp(-x * 4)) * Math.min(1, x / 0.003) * Math.exp(-x * 1.8) * 0.045, (i - 1.5) * 0.3, 0.9);
      });
    }
  }

  const wet = reverb(send);
  let peak = 0;
  for (let n = 0; n < N; n++) {
    const t = n / SR;
    const fade = Math.min(1, t / 0.4) * Math.min(1, (dur - t) / 1.6);
    L[n] = (L[n] + wet[n] * 0.35) * fade;
    R[n] = (R[n] + wet[(n + 240) % N] * 0.35) * fade;
    peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
  }
  const g = peak > 0 ? 0.89 / peak : 1;
  return { L, R, g, N };
}

function writeMusic(file, dur, events) {
  const { L, R, g, N } = render(dur, events);
  const buf = Buffer.alloc(44 + N * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
  for (let n = 0; n < N; n++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[n] * g)) * 32767), 44 + n * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[n] * g)) * 32767), 46 + n * 4);
  }
  fs.writeFileSync(file, buf);
}

module.exports = { writeMusic };
