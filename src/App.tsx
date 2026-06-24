import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import PixelCanvas from './components/PixelCanvas';
import Toolbar, { DB32_PALETTE, EXTRA_COLORS, Swatch } from './components/Toolbar';
import TopMenu from './components/TopMenu';
import ImageImporter from './components/ImageImporter';
import Timeline from './components/Timeline';
import { useHistory } from './hooks/useHistory';
import JSZip from 'jszip';
// @ts-ignore
import GIF from 'gif.js';

const DEFAULT_WIDTH = 32;
const DEFAULT_HEIGHT = 32;
const MAX_FRAMES = 48;
const FULL_PALETTE = [...DB32_PALETTE, ...EXTRA_COLORS];

export type LayerKey = 'melody' | 'percussion';
export interface Frame {
  melody: string[];
  percussion: string[];
  melodySlide: boolean[]; // per-cell "slide" flag for the melody layer (gliding note)
}

// Monochrome icons for the layer toggle, in the same filled style as the toolbar tools.
const MelodyIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
    <path d="M470.38 1.51L150.41 96A32 32 0 0 0 128 126.51v261.41A139 139 0 0 0 96 384c-53 0-96 28.66-96 64s43 64 96 64 96-28.66 96-64V214.32l256-75v184.61a138.4 138.4 0 0 0-32-3.93c-53 0-96 28.66-96 64s43 64 96 64 96-28.65 96-64V32a32 32 0 0 0-41.62-30.49z" />
  </svg>
);
const PercussionIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
    <ellipse cx="256" cy="250" rx="160" ry="58" />
    <path d="M96 250 v116 a160 58 0 0 0 320 0 V250 Z" />
    <line x1="296" y1="205" x2="128" y2="78" stroke="currentColor" strokeWidth="30" strokeLinecap="round" />
    <line x1="216" y1="205" x2="384" y2="78" stroke="currentColor" strokeWidth="30" strokeLinecap="round" />
  </svg>
);

const makeLayer = (w: number, h: number) => Array(w * h).fill('transparent');
const makeMask = (w: number, h: number) => Array(w * h).fill(false);
const makeFrame = (w: number, h: number): Frame => ({ melody: makeLayer(w, h), percussion: makeLayer(w, h), melodySlide: makeMask(w, h) });
// Merge both layers into a single pixel array for export/preview (percussion drawn over melody).
const compositeFrame = (frame: Frame): string[] => {
  const out = [...frame.melody];
  frame.percussion.forEach((c, i) => { if (c !== 'transparent') out[i] = c; });
  return out;
};

const SCALES = {
  MAJOR_PENTA: [0, 2, 4, 7, 9],
  MINOR_PENTA: [0, 3, 5, 7, 10],
  LYDIAN: [0, 2, 4, 6, 7, 9, 11],
  PHRYGIAN: [0, 1, 3, 5, 7, 8, 10]
};

const BASE_FREQ = 65.41;

const generateScaleFreqs = (steps: number[]) => {
  const freqs: number[] = [];
  for (let i = 0; i < 32; i++) {
    const octave = Math.floor(i / steps.length);
    const stepIndex = i % steps.length;
    const semitones = octave * 12 + steps[stepIndex];
    freqs.push(BASE_FREQ * Math.pow(2, semitones / 12));
  }
  return freqs;
};

const SCALE_FREQS = {
  MAJOR: generateScaleFreqs(SCALES.MAJOR_PENTA),
  MINOR: generateScaleFreqs(SCALES.MINOR_PENTA),
  DREAMY: generateScaleFreqs(SCALES.LYDIAN),
  DARK: generateScaleFreqs(SCALES.PHRYGIAN)
};

interface BgTransform {
  x: number; y: number; scale: number; rotation: number; opacity: number;
}

const getByWord = () => {
  if (typeof navigator === 'undefined') return 'by';
  const lang = (navigator.language || 'en').toLowerCase();
  if (lang.startsWith('es') || lang.startsWith('pt')) return 'por';
  if (lang.startsWith('fr')) return 'par';
  if (lang.startsWith('it')) return 'di';
  if (lang.startsWith('de')) return 'von';
  if (lang.startsWith('ca')) return 'per';
  if (lang.startsWith('nl')) return 'door';
  return 'by';
};

const getStartHint = () => {
  if (typeof navigator === 'undefined') return 'Tap to start';
  const lang = (navigator.language || 'en').toLowerCase();
  if (lang === 'es-ar' || lang === 'es-uy') return 'Tocá para empezar';
  if (lang.startsWith('es')) return 'Toca para empezar';
  if (lang.startsWith('pt')) return 'Toque para começar';
  if (lang.startsWith('fr')) return 'Touchez pour commencer';
  if (lang.startsWith('it')) return 'Tocca per iniziare';
  if (lang.startsWith('de')) return 'Tippen zum Starten';
  if (lang.startsWith('ca')) return 'Toca per començar';
  if (lang.startsWith('nl')) return 'Tik om te beginnen';
  return 'Tap to start';
};

const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(`(max-width: ${breakpoint}px)`).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
};

const getNeighborsCount = (pixels: string[], index: number, width: number, height: number, color: string) => {
  const x = index % width;
  const y = Math.floor(index / width);
  let neighbors = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        if (pixels[ny * width + nx] === color) neighbors++;
      }
    }
  }
  return neighbors;
};

function App() {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [projectName, setProjectName] = useState('animacion');
  const [frames, setFrames] = useState<Frame[]>([
    makeFrame(DEFAULT_WIDTH, DEFAULT_HEIGHT)
  ]);
  const [activeLayer, setActiveLayer] = useState<LayerKey>('melody');
  const [slideMode, setSlideMode] = useState(false); // paint melody cells as gliding "slide" notes
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);

  const framesRef = useRef(frames);
  useEffect(() => { framesRef.current = frames; }, [frames]);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);
  // Persistent gliding voice for blue notes (lives across frames during playback).
  const glideRef = useRef<{ osc: OscillatorNode; gain: GainNode; pan: StereoPannerNode; lp: BiquadFilterNode } | null>(null);

  const { pushState, undo, redo, canUndo, canRedo, reset } = useHistory(frames);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentTool, setCurrentTool] = useState<'brush' | 'eraser' | 'fill' | 'eyedropper'>('brush');
  const [zoom, setZoom] = useState(15);
  const [showGrid, setShowGrid] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(12);
  const [onionSkin, setOnionSkin] = useState(0);
  const [darkMode, setDarkMode] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastAddedIndex, setLastAddedIndex] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(true);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [paletteExpanded, setPaletteExpanded] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [fpsDragOrigin, setFpsDragOrigin] = useState<{ y: number; fps: number } | null>(null);
  const [tutorialStrokes, setTutorialStrokes] = useState(0);
  const [tutorialPlayedOnce, setTutorialPlayedOnce] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [exportWithGrid, setExportWithGrid] = useState(false);
  const [canvasBgColor, setCanvasBgColor] = useState('#ffffff');
  const [showUpdateDot, setShowUpdateDot] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('lastSeenBuild') !== __BUILD_ID__; } catch { return false; }
  });
  const markBuildSeen = useCallback(() => {
    if (!showUpdateDot) return;
    try { localStorage.setItem('lastSeenBuild', __BUILD_ID__); } catch {}
    setShowUpdateDot(false);
  }, [showUpdateDot]);
  const isMobile = useIsMobile();
  const highlightAddFrame = tutorialStrokes >= 2 && frames.length === 1;
  const highlightPlay = frames.length > 1 && !tutorialPlayedOnce;

  const audioCtx = useRef<AudioContext | null>(null);
  const delayNode = useRef<DelayNode | null>(null);
  const feedbackNode = useRef<GainNode | null>(null);
  const filterNode = useRef<BiquadFilterNode | null>(null);
  const masterGain = useRef<GainNode | null>(null);

  const [bgImage, setBgImage] = useState<string | null>(null);
  const [isEditingBg, setIsEditingBg] = useState(false);
  const [bgTransform, setBgTransform] = useState<BgTransform>({
    x: 0, y: 0, scale: 1, rotation: 0, opacity: 0.5
  });

  const initAudio = useCallback(() => {
    if (audioCtx.current) return audioCtx.current;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const mGain = ctx.createGain();
    mGain.connect(ctx.destination);
    masterGain.current = mGain;

    const dNode = ctx.createDelay(3.0);
    const fNode = ctx.createGain();
    const lpfNode = ctx.createBiquadFilter();
    lpfNode.type = 'lowpass';
    lpfNode.frequency.value = 1200;
    lpfNode.Q.value = 0.7;
    dNode.delayTime.value = 0.5;
    fNode.gain.value = 0.3;
    dNode.connect(fNode);
    fNode.connect(dNode);
    dNode.connect(lpfNode);
    lpfNode.connect(mGain);
    audioCtx.current = ctx;
    delayNode.current = dNode;
    feedbackNode.current = fNode;
    filterNode.current = lpfNode;

    // iOS WebKit unlock — try every known trick inside the same gesture.
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    try {
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch {}
    try {
      const a = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      a.preload = 'auto';
      (a as any).playsInline = true;
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {}

    return ctx;
  }, []);

  useEffect(() => {
    if (!showUpdateDot) return;
    const onFirstInteraction = () => markBuildSeen();
    window.addEventListener('pointerdown', onFirstInteraction, { once: true });
    return () => window.removeEventListener('pointerdown', onFirstInteraction);
  }, [showUpdateDot, markBuildSeen]);

  useEffect(() => {
    const unlock = () => {
      // iOS WebKit: an HTMLAudioElement playing a silent wav inside the
      // user gesture grants the page an audio session, which then lets
      // Web Audio actually produce output.
      try {
        const a = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        a.preload = 'auto';
        (a as any).playsInline = true;
        const p = a.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {}
      const ctx = initAudio();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('touchstart', unlock, { once: true, capture: true });
    window.addEventListener('click', unlock, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true } as any);
      window.removeEventListener('touchstart', unlock, { capture: true } as any);
      window.removeEventListener('click', unlock, { capture: true } as any);
    };
  }, [initAudio]);

  useEffect(() => {
    if (delayNode.current && onionSkin > 0) {
      const frameMultipliers = [0, 4, 6, 8, 12];
      const delayTimeSeconds = frameMultipliers[onionSkin] / fps;
      delayNode.current.delayTime.setTargetAtTime(delayTimeSeconds, audioCtx.current?.currentTime || 0, 0.1);
    }
  }, [onionSkin, fps]);

  const getHexInfo = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const s = max === min ? 0 : (l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min));
    let h = 0;
    if (max !== min) {
      const d = max - min;
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return { s, l, h };
  };

  const getWaveformByColor = (hex: string): OscillatorType => {
    const info = getHexInfo(hex);
    if (info.s > 0.75) return 'sawtooth';
    if (info.s > 0.4) return 'square';
    if (info.s > 0.1) return 'triangle';
    return 'sine';
  };

  const getResultantScale = useCallback((framePixels: string[]) => {
    const activeColors = framePixels.filter(c => c !== 'transparent' && c.toLowerCase() !== '#ffffff');
    if (activeColors.length === 0) return SCALE_FREQS.MAJOR;
    let totalS = 0, totalL = 0;
    activeColors.forEach(c => {
      const info = getHexInfo(c);
      totalS += info.s;
      totalL += info.l;
    });
    const avgS = totalS / activeColors.length;
    const avgL = totalL / activeColors.length;
    if (avgL > 0.5) return avgS > 0.4 ? SCALE_FREQS.MAJOR : SCALE_FREQS.DREAMY;
    return avgS > 0.4 ? SCALE_FREQS.MINOR : SCALE_FREQS.DARK;
  }, []);

  const playSingleNote = useCallback((row: number, color: string, xPos: number, volumeFactor = 1, colorDensity = 1) => {
    if (!audioEnabled || !color || color === 'transparent' || color.toLowerCase() === '#ffffff') return;
    const ctx = initAudio();
    const schedule = () => {
      const info = getHexInfo(color);
      const framePixels = framesRef.current[currentFrameIndex].melody;
      const currentScale = getResultantScale(framePixels);
      const noteFreq = currentScale[31 - row] || 440;
      const t0 = ctx.currentTime + 0.02;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      osc.type = getWaveformByColor(color);
      osc.frequency.setValueAtTime(noteFreq, t0);
      pan.pan.setValueAtTime((xPos / width) * 2 - 1, t0);
      const volume = 0.05 * volumeFactor;
      const attackTime = Math.min(0.08, 0.2 * (1 - info.s) + 0.005);

      const neighbors = getNeighborsCount(framePixels, row * width + xPos, width, height, color);
      const decayTime = Math.min(2.0, Math.max(attackTime + 0.25, 0.2 + (neighbors * 0.2) + (colorDensity / 100)));

      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(volume, t0 + attackTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decayTime);
      osc.connect(pan);
      pan.connect(gain);
      if (filterNode.current) gain.connect(filterNode.current);
      if (onionSkin > 0 && delayNode.current) gain.connect(delayNode.current);
      gain.connect(masterGain.current || ctx.destination);
      osc.start(t0);
      osc.stop(t0 + decayTime + 0.1);
    };
    if (ctx.state === 'running') {
      schedule();
    } else {
      let fired = false;
      const safe = () => { if (!fired) { fired = true; schedule(); } };
      ctx.resume().then(safe, safe);
      setTimeout(safe, 200);
    }
  }, [audioEnabled, initAudio, width, height, onionSkin, currentFrameIndex, getResultantScale]);

  const playFrameMelody = useCallback((framePixels: string[], slideMask?: boolean[]) => {
    const pixelsByRow: Map<number, {color: string, x: number}[]> = new Map();
    const colorCounts: Map<string, number> = new Map();
    framePixels.forEach((color, i) => {
      if (color !== 'transparent' && color.toLowerCase() !== '#ffffff' && !(slideMask && slideMask[i])) {
        const row = Math.floor(i / width);
        if (!pixelsByRow.has(row)) pixelsByRow.set(row, []);
        pixelsByRow.get(row)!.push({color, x: i % width});
        colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
      }
    });
    const activeRows = Array.from(pixelsByRow.keys());
    if (activeRows.length === 0) return;
    const currentScale = getResultantScale(framePixels);
    const maxNotes = Math.min(5, activeRows.length);
    const selectedRows = activeRows.sort(() => 0.5 - Math.random()).slice(0, maxNotes);
    const ctx = initAudio();
    const scheduleAll = () => {
      selectedRows.forEach(row => {
        const data = pixelsByRow.get(row)![0];
        const density = colorCounts.get(data.color) || 1;
        const noteFreq = currentScale[31 - row] || 440;
        const t0 = ctx.currentTime + 0.02;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const pan = ctx.createStereoPanner();
        osc.type = getWaveformByColor(data.color);
        osc.frequency.setValueAtTime(noteFreq, t0);
        pan.pan.setValueAtTime((data.x / width) * 2 - 1, t0);
        // Denser color (more cells) = louder note.
        const volume = 0.06 * Math.min(1, 0.35 + density * 0.05);
        const info = getHexInfo(data.color);
        const attackTime = Math.min(0.08, 0.2 * (1 - info.s) + 0.005);

        const neighbors = getNeighborsCount(framePixels, row * width + data.x, width, height, data.color);
        const decayTime = Math.min(2.0, Math.max(attackTime + 0.25, 0.2 + (neighbors * 0.2) + (density / 100)));

        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(volume, t0 + attackTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decayTime);
        osc.connect(pan);
        pan.connect(gain);
        if (onionSkin > 0 && delayNode.current) gain.connect(delayNode.current);
        gain.connect(masterGain.current || ctx.destination);
        osc.start(t0);
        osc.stop(t0 + decayTime + 0.1);
      });
    };
    if (ctx.state === 'running') {
      scheduleAll();
    } else {
      let fired = false;
      const safe = () => { if (!fired) { fired = true; scheduleAll(); } };
      ctx.resume().then(safe, safe);
      setTimeout(safe, 200);
    }
  }, [initAudio, width, height, onionSkin, getResultantScale]);

  // ----- GLIDE/SLIDE VOICE (melody) -----
  // Cells painted with "slide" don't re-trigger every frame; one sustained
  // oscillator bends its pitch toward each frame's slide note (portamento).
  const releaseGlide = useCallback(() => {
    const v = glideRef.current;
    if (!v) return;
    glideRef.current = null;
    const ctx = audioCtx.current;
    const now = ctx ? ctx.currentTime : 0;
    try {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), now);
      v.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      v.osc.stop(now + 0.18);
    } catch {}
  }, []);

  const updateGlideVoice = useCallback((framePixels: string[], slideMask: boolean[]) => {
    if (!audioEnabled) { releaseGlide(); return; }
    let sumRow = 0, sumX = 0, n = 0, repColor = '';
    framePixels.forEach((c, i) => {
      if (!slideMask[i] || c === 'transparent' || c.toLowerCase() === '#ffffff') return;
      sumRow += Math.floor(i / width); sumX += i % width; n++;
      if (!repColor) repColor = c;
    });
    const ctx = initAudio();
    const now = ctx.currentTime;
    // Denser slide (more cells) = louder sustained note, like the plucks.
    const volume = 0.05 * Math.min(1, 0.4 + n * 0.05);
    const glide = Math.max(0.02, (1 / fps) * 0.55);
    const v = glideRef.current;

    // Rest (no slide this frame): fade to silence but KEEP the voice alive, so the
    // next slide note just swells back in instead of re-attacking percussively.
    if (n === 0) {
      if (v) v.gain.gain.setTargetAtTime(0.0001, now, 0.05);
      return;
    }

    const scale = getResultantScale(framePixels);
    const avgRow = Math.round(sumRow / n);
    const targetFreq = Math.max(20, scale[31 - avgRow] || 220);
    const panVal = (sumX / n / width) * 2 - 1;
    // Theremin-like timbre: smooth waveform + a mellow lowpass. Brighter blues open
    // the filter a little, so they still differ subtly without ever getting harsh.
    const slideInfo = getHexInfo(repColor);
    const wave: OscillatorType = slideInfo.s > 0.55 ? 'triangle' : 'sine';
    const cutoff = 1100 + slideInfo.s * 1500;

    if (!v) {
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      osc.type = wave;
      osc.frequency.setValueAtTime(targetFreq, now);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(cutoff, now);
      lp.Q.value = 0.7;
      pan.pan.setValueAtTime(panVal, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.setTargetAtTime(volume, now, 0.12); // gentle exponential attack (~0.35s)
      osc.connect(lp); lp.connect(pan); pan.connect(gain);
      if (onionSkin > 0 && delayNode.current) gain.connect(delayNode.current);
      gain.connect(masterGain.current || ctx.destination);
      osc.start(now);
      glideRef.current = { osc, gain, pan, lp };
    } else {
      if (v.osc.type !== wave) v.osc.type = wave; // keep each color's (mellow) timbre
      v.lp.frequency.setTargetAtTime(cutoff, now, 0.1);
      v.osc.frequency.cancelScheduledValues(now);
      v.osc.frequency.setValueAtTime(Math.max(20, v.osc.frequency.value), now);
      v.osc.frequency.exponentialRampToValueAtTime(targetFreq, now + glide); // the bend
      v.pan.pan.cancelScheduledValues(now);
      v.pan.pan.linearRampToValueAtTime(panVal, now + glide);
      v.gain.gain.setTargetAtTime(volume, now, 0.12); // smoothly hold level / re-enter from a rest
    }
  }, [audioEnabled, width, fps, onionSkin, initAudio, getResultantScale, releaseGlide]);

  // ----- PERCUSSION ENGINE -----
  // A color maps to a drum voice by saturation (material), lightness (size/pitch)
  // and hue (variant). Within a voice, hue + lightness also fine-tune the timbre,
  // so different colors that land on the same family still sound distinct.
  type Drum =
    | 'kick' | 'tomLow' | 'tomMid' | 'tomHigh'      // membranes (desaturated, dark->light)
    | 'rim' | 'wood' | 'clave'                       // wood / clicks
    | 'snare' | 'clap' | 'conga' | 'cowbell'         // skins & hands (mid saturation)
    | 'hihat' | 'openhat' | 'ride' | 'crash' | 'shaker' | 'tambourine'; // metals (saturated)
  const classifyDrum = useCallback((hex: string): Drum => {
    const { s, l, h } = getHexInfo(hex);
    if (s < 0.2) {
      if (l < 0.2) return 'kick';
      if (l < 0.35) return 'tomLow';
      if (l < 0.5) return 'tomMid';
      if (l < 0.68) return 'tomHigh';
      return 'rim';
    }
    if (s < 0.5) {
      if (l < 0.3) return 'conga';
      if (h < 60 || h >= 320) return 'snare';   // reds / magentas
      if (h < 170) return 'clap';               // yellows / greens
      if (h < 270) return 'wood';               // cyans / blues
      return 'clave';                           // purples
    }
    // saturated -> metals, picked by hue then lightness
    if (l < 0.38) return 'cowbell';
    if (h < 55) return 'crash';                 // red / orange
    if (h < 150) return 'ride';                 // yellow / green
    if (h < 205) return 'hihat';                // cyan
    if (h < 280) return 'openhat';              // blue
    return l > 0.7 ? 'shaker' : 'tambourine';   // magenta / pink
  }, []);

  const getNoiseBuffer = useCallback((ctx: AudioContext) => {
    if (noiseBufferRef.current && noiseBufferRef.current.sampleRate === ctx.sampleRate) return noiseBufferRef.current;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBufferRef.current = buf;
    return buf;
  }, []);

  const baseVol: Record<Drum, number> = {
    kick: 0.42, tomLow: 0.32, tomMid: 0.28, tomHigh: 0.26,
    rim: 0.22, wood: 0.2, clave: 0.2,
    snare: 0.22, clap: 0.2, conga: 0.24, cowbell: 0.18,
    hihat: 0.14, openhat: 0.14, ride: 0.13, crash: 0.16, shaker: 0.12, tambourine: 0.15,
  };

  const playDrumHit = useCallback((ctx: AudioContext, drum: Drum, t0: number, panVal: number, vol: number, light: number, hue: number) => {
    const out = masterGain.current || ctx.destination;
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, panVal)), t0);
    panner.connect(out);
    if (onionSkin > 0 && delayNode.current) panner.connect(delayNode.current);
    // tuning factors: brighter color -> a bit higher/brighter; hue -> small detune
    const tune = 0.8 + light * 0.5;
    const hueShift = 1 + ((hue / 360) - 0.5) * 0.25;

    const tone = (type: OscillatorType, f0: number, f1: number, peak: number, dur: number, at = t0) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, at);
      if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur * 0.9);
      g.gain.setValueAtTime(peak, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(g); g.connect(panner);
      osc.start(at); osc.stop(at + dur + 0.02);
    };
    const noise = (type: BiquadFilterType, freq: number, q: number, peak: number, dur: number, at = t0) => {
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(ctx);
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(peak, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(f); f.connect(g); g.connect(panner);
      src.start(at); src.stop(at + dur + 0.02);
    };

    switch (drum) {
      case 'kick': {
        // Darker = deeper: pure black drops ~an octave into sub-bass (~55 Hz).
        const f0 = 55 + light * 320;
        tone('sine', f0, Math.max(28, f0 * 0.4), vol, 0.9);  // long sub fundamental
        break;
      }
      case 'tomLow': tone('sine', 150 * tune, 80, vol, 0.3); break;
      case 'tomMid': tone('sine', 210 * tune, 110, vol, 0.26); break;
      case 'tomHigh': tone('sine', 300 * tune, 160, vol, 0.22); break;
      case 'rim':
        tone('square', 420, 420, vol * 0.6, 0.03);
        noise('bandpass', 2600, 3, vol, 0.04);
        break;
      case 'wood': tone('square', 900 * tune, 900 * tune, vol, 0.06); break;
      case 'clave':
        tone('triangle', 2400 * hueShift, 2400 * hueShift, vol, 0.035);
        tone('sine', 2400 * hueShift, 2400 * hueShift, vol * 0.6, 0.05);
        break;
      case 'snare':
        tone('triangle', 180 * tune, 180 * tune, vol * 0.5, 0.12);
        noise('bandpass', 1800 * hueShift, 0.8, vol, 0.2);
        break;
      case 'clap':
        [0, 0.012, 0.026].forEach((off, k) =>
          noise('bandpass', 1500 * hueShift, 1.0, vol * (k === 2 ? 1 : 0.7), k === 2 ? 0.18 : 0.05, t0 + off));
        break;
      case 'conga': tone('sine', 260 * tune, 230 * tune, vol, 0.18); break;
      case 'cowbell':
        tone('square', 540 * hueShift, 540 * hueShift, vol * 0.7, 0.3);
        tone('square', 800 * hueShift, 800 * hueShift, vol * 0.7, 0.3);
        break;
      case 'hihat': noise('highpass', 8000, 0, vol, 0.045); break;
      case 'openhat': noise('highpass', 8000, 0, vol, 0.28 + light * 0.2); break;
      case 'ride':
        noise('highpass', 6000, 0, vol * 0.8, 0.4 + light * 0.3);
        tone('square', 3200 * hueShift, 3200 * hueShift, vol * 0.25, 0.3);
        break;
      case 'crash': noise('highpass', 5000, 0, vol, 0.6 + light * 0.6); break;
      case 'shaker': noise('bandpass', 6500, 1, vol, 0.07); break;
      case 'tambourine':
        noise('bandpass', 7000, 2, vol, 0.18);
        tone('square', 9000, 9000, vol * 0.2, 0.05);
        break;
    }
  }, [onionSkin, getNoiseBuffer]);

  const playFramePercussion = useCallback((framePixels: string[]) => {
    if (!audioEnabled) return;
    const groups = new Map<Drum, { count: number; sumX: number; sumL: number; sumH: number }>();
    framePixels.forEach((c, i) => {
      if (c === 'transparent' || c.toLowerCase() === '#ffffff') return;
      const drum = classifyDrum(c);
      const info = getHexInfo(c);
      const g = groups.get(drum) || { count: 0, sumX: 0, sumL: 0, sumH: 0 };
      g.count++; g.sumX += i % width; g.sumL += info.l; g.sumH += info.h;
      groups.set(drum, g);
    });
    if (groups.size === 0) return;
    const ctx = initAudio();
    const fire = () => {
      const t0 = ctx.currentTime + 0.02;
      groups.forEach((g, drum) => {
        const pan = (g.sumX / g.count / width) * 2 - 1;
        const density = Math.min(1, 0.4 + g.count * 0.05);
        playDrumHit(ctx, drum, t0, pan, baseVol[drum] * density, g.sumL / g.count, g.sumH / g.count);
      });
    };
    if (ctx.state === 'running') { fire(); }
    else { let fired = false; const safe = () => { if (!fired) { fired = true; fire(); } }; ctx.resume().then(safe, safe); setTimeout(safe, 200); }
  }, [audioEnabled, width, initAudio, classifyDrum, playDrumHit]);

  // Live single-hit feedback while drawing/previewing in percussion mode (same signature as playSingleNote).
  const playPercussionSingle = useCallback((_row: number, color: string, xPos: number, volumeFactor = 1, colorDensity = 1) => {
    if (!audioEnabled || !color || color === 'transparent' || color.toLowerCase() === '#ffffff') return;
    const ctx = initAudio();
    const fire = () => {
      const drum = classifyDrum(color);
      const info = getHexInfo(color);
      const t0 = ctx.currentTime + 0.02;
      const density = Math.min(1, 0.4 + colorDensity * 0.05);
      playDrumHit(ctx, drum, t0, (xPos / width) * 2 - 1, baseVol[drum] * density * volumeFactor, info.l, info.h);
    };
    if (ctx.state === 'running') { fire(); }
    else { let fired = false; const safe = () => { if (!fired) { fired = true; fire(); } }; ctx.resume().then(safe, safe); setTimeout(safe, 200); }
  }, [audioEnabled, width, initAudio, classifyDrum, playDrumHit]);

  // Composite for scrub/preview: melody (slide cells play as normal notes) + percussion.
  const playFrameSound = useCallback((frame: Frame) => {
    playFrameMelody(frame.melody);
    playFramePercussion(frame.percussion);
  }, [playFrameMelody, playFramePercussion]);

  // Composite for continuous playback: slide cells feed the sustained glide voice
  // (excluded from the per-frame plucks) so they bend between frames.
  const playFramePlayback = useCallback((frame: Frame) => {
    updateGlideVoice(frame.melody, frame.melodySlide);
    playFrameMelody(frame.melody, frame.melodySlide);
    playFramePercussion(frame.percussion);
  }, [updateGlideVoice, playFrameMelody, playFramePercussion]);

  // Audition a color in the active mode (a melody note or a drum hit).
  const previewColor = useCallback((c: string) => {
    if (!c || c === 'transparent' || c.toLowerCase() === '#ffffff') return;
    if (activeLayer === 'melody') playSingleNote(Math.floor(height / 2), c, Math.floor(width / 2), 1, 30);
    else playPercussionSingle(0, c, Math.floor(width / 2), 1, 8);
  }, [activeLayer, height, width, playSingleNote, playPercussionSingle]);

  // Selecting a color also auditions it.
  const selectColor = useCallback((c: string) => {
    setCurrentColor(c);
    previewColor(c);
  }, [previewColor]);

  useEffect(() => {
    let interval: number | undefined;
    if (isPlaying && framesRef.current.length > 1) {
      interval = window.setInterval(() => {
        setCurrentFrameIndex((prev) => {
          const next = (prev + 1) % framesRef.current.length;
          playFramePlayback(framesRef.current[next]);
          return next;
        });
      }, 1000 / fps);
    } else {
      releaseGlide();
    }
    return () => window.clearInterval(interval);
  }, [isPlaying, fps, playFramePlayback, releaseGlide]);

  const otherLayer: LayerKey = activeLayer === 'melody' ? 'percussion' : 'melody';
  const currentFrame = frames[currentFrameIndex];
  const pixels = currentFrame[activeLayer];
  const underlayPixels = currentFrame[otherLayer];
  const setActiveLayerPixels = (newFrames: Frame[], idx: number, layerPixels: string[]) => {
    newFrames[idx] = { ...newFrames[idx], [activeLayer]: layerPixels };
  };
  // When painting melody, mark newly-painted cells with the current slide state
  // (and clear erased cells), by diffing the old vs new melody arrays.
  const writeMelodyWithSlide = (newFrames: Frame[], idx: number, newMelody: string[]) => {
    const cur = newFrames[idx];
    const mask = (cur.melodySlide || makeMask(width, height)).slice();
    for (let i = 0; i < newMelody.length; i++) {
      if (newMelody[i] !== cur.melody[i]) mask[i] = newMelody[i] === 'transparent' ? false : slideMode;
    }
    newFrames[idx] = { ...cur, melody: newMelody, melodySlide: mask };
  };
  const updatePixels = (newPixels: string[]) => {
    const newFrames = [...frames];
    if (activeLayer === 'melody') writeMelodyWithSlide(newFrames, currentFrameIndex, newPixels);
    else setActiveLayerPixels(newFrames, currentFrameIndex, newPixels);
    setFrames(newFrames);
  };
  const handleImport = (importedPixels: string[]) => {
    const newFrames = [...frames];
    if (activeLayer === 'melody') newFrames[currentFrameIndex] = { ...newFrames[currentFrameIndex], melody: importedPixels, melodySlide: makeMask(width, height) };
    else setActiveLayerPixels(newFrames, currentFrameIndex, importedPixels);
    setFrames(newFrames); pushState(newFrames); setIsImporting(false);
  };
  const handleHistoryPush = (pixelsToPush: string[]) => {
    const newFrames = [...frames];
    if (activeLayer === 'melody') writeMelodyWithSlide(newFrames, currentFrameIndex, pixelsToPush);
    else setActiveLayerPixels(newFrames, currentFrameIndex, pixelsToPush);
    pushState(newFrames);
  };
  // Active-layer view of every frame — used for onion skin (canvas) and timeline thumbnails.
  const activeLayerFrames = frames.map(f => f[activeLayer]);
  const handleUndo = () => { const prevState = undo(); if (prevState) { setFrames(prevState); if (currentFrameIndex >= prevState.length) setCurrentFrameIndex(prevState.length - 1); } };
  const handleRedo = () => { const nextState = redo(); if (nextState) { setFrames(nextState); if (currentFrameIndex >= nextState.length) setCurrentFrameIndex(nextState.length - 1); } };
  const handleNew = () => { if (confirm('¿Estás seguro?')) { const emptyFrames = [makeFrame(width, height)]; setFrames(emptyFrames); setProjectName('animate'); setCurrentFrameIndex(0); reset(emptyFrames); } };
  
  const handleSave = () => {
    const data = JSON.stringify({
      projectName,
      width,
      height,
      frames,
      bgImage,
      bgTransform
    });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName}.json`;
    link.click();
  };

  const handleOpen = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = JSON.parse(e.target?.result as string);
          if (content.projectName) {
            setProjectName(content.projectName);
          } else {
            setProjectName(file.name.replace('.json', ''));
          }
          const w = content.width, h = content.height;
          setWidth(w);
          setHeight(h);
          if (content.frames) {
            // Migrate legacy frames: single-layer (string[][]) and pre-slide {melody,percussion}.
            const migrated: Frame[] = content.frames.map((f: any) => {
              if (Array.isArray(f)) return { melody: f as string[], percussion: makeLayer(w, h), melodySlide: makeMask(w, h) };
              return { melody: f.melody, percussion: f.percussion, melodySlide: f.melodySlide || makeMask(w, h) };
            });
            setFrames(migrated);
            reset(migrated);
          }
          if (content.bgImage) setBgImage(content.bgImage);
          if (content.bgTransform) setBgTransform(content.bgTransform);
          setCurrentFrameIndex(0);
        } catch (err) {
          alert('Error al abrir el archivo.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const addFrame = () => { 
    if (frames.length >= MAX_FRAMES) return; 
    const newFrames = [...frames];
    const emptyFrame = makeFrame(width, height);
    const nextIdx = currentFrameIndex + 1;
    newFrames.splice(nextIdx, 0, emptyFrame);
    setFrames(newFrames); 
    setCurrentFrameIndex(nextIdx); 
    setLastAddedIndex(nextIdx);
    setTimeout(() => setLastAddedIndex(null), 600);
    pushState(newFrames); 
  };
  const duplicateFrame = () => { 
    if (frames.length >= MAX_FRAMES) return; 
    const newFrames = [...frames];
    const src = frames[currentFrameIndex];
    const duplicatedFrame: Frame = { melody: [...src.melody], percussion: [...src.percussion], melodySlide: [...src.melodySlide] };
    const nextIdx = currentFrameIndex + 1;
    newFrames.splice(nextIdx, 0, duplicatedFrame);
    setFrames(newFrames); 
    setCurrentFrameIndex(nextIdx); 
    setLastAddedIndex(nextIdx);
    setTimeout(() => setLastAddedIndex(null), 600);
    pushState(newFrames); 
  };
  const removeFrame = () => { if (frames.length <= 1) return; const newFrames = frames.filter((_, i) => i !== currentFrameIndex); setFrames(newFrames); setCurrentFrameIndex(Math.max(0, currentFrameIndex - 1)); pushState(newFrames); };
  // Clears ONLY the active layer's content (frame stays in the timeline).
  const clearFrame = () => {
    const newFrames = [...frames];
    const cur = frames[currentFrameIndex];
    newFrames[currentFrameIndex] = activeLayer === 'melody'
      ? { ...cur, melody: makeLayer(width, height), melodySlide: makeMask(width, height) }
      : { ...cur, percussion: makeLayer(width, height) };
    setFrames(newFrames); pushState(newFrames);
  };
  const shiftPixels = (dx: number, dy: number) => {
    const newPixels = Array(width * height).fill('transparent');
    const newMask = makeMask(width, height);
    const cur = frames[currentFrameIndex];
    const currentPixels = cur[activeLayer];
    const currentMask = cur.melodySlide;
    for (let y = 0; y < height; y++) { for (let x = 0; x < width; x++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        newPixels[ny * width + nx] = currentPixels[y * width + x];
        if (activeLayer === 'melody') newMask[ny * width + nx] = currentMask[y * width + x];
      }
    } }
    const newFrames = [...frames];
    newFrames[currentFrameIndex] = activeLayer === 'melody'
      ? { ...cur, melody: newPixels, melodySlide: newMask }
      : { ...cur, percussion: newPixels };
    setFrames(newFrames); pushState(newFrames);
  };

  const moveFrame = (fromIndex: number, toIndex: number) => {
    const newFrames = [...frames];
    const [movedFrame] = newFrames.splice(fromIndex, 1);
    newFrames.splice(toIndex, 0, movedFrame);
    setFrames(newFrames);
    setCurrentFrameIndex(toIndex);
    pushState(newFrames);
  };

  const handleExport = async (format: 'png' | 'gif' | 'mp4' | 'png-seq' | 'jpg-seq') => {
    const zip = new JSZip();
    const drawGrid = (ctx: CanvasRenderingContext2D, exportW: number, exportH: number) => {
      const pxW = exportW / width;
      const pxH = exportH / height;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x++) {
        const px = Math.round(x * pxW) + 0.5;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, exportH);
      }
      for (let y = 0; y <= height; y++) {
        const py = Math.round(y * pxH) + 0.5;
        ctx.moveTo(0, py);
        ctx.lineTo(exportW, py);
      }
      ctx.stroke();
    };
    const getFrameCanvas = (framePixels: string[], exportWidth = width, exportHeight = height) => {
      const canvas = document.createElement('canvas'); canvas.width = exportWidth; canvas.height = exportHeight;
      const ctx = canvas.getContext('2d'); if (!ctx) return null;
      const pixelSizeX = exportWidth / width;
      const pixelSizeY = exportHeight / height;
      framePixels.forEach((color, index) => {
        const x = index % width;
        const y = Math.floor(index / width);
        if (color === 'transparent') {
          if (format === 'jpg-seq' || format === 'mp4') {
            ctx.fillStyle = canvasBgColor;
            ctx.fillRect(x * pixelSizeX, y * pixelSizeY, pixelSizeX, pixelSizeY);
          }
          return;
        }
        ctx.fillStyle = color;
        ctx.fillRect(x * pixelSizeX, y * pixelSizeY, pixelSizeX, pixelSizeY);
      });
      if (exportWithGrid) drawGrid(ctx, exportWidth, exportHeight);
      return canvas;
    };
    if (format === 'png') {
      const canvas = getFrameCanvas(compositeFrame(frames[currentFrameIndex])); if (!canvas) return;
      const link = document.createElement('a'); link.download = `${projectName}_frame_${currentFrameIndex + 1}.png`; link.href = canvas.toDataURL('image/png'); link.click();
    } else if (format === 'png-seq' || format === 'jpg-seq') {
      const extension = format === 'png-seq' ? 'png' : 'jpg';
      const mimeType = format === 'png-seq' ? 'image/png' : 'image/jpeg';
      for (let i = 0; i < frames.length; i++) {
        const canvas = getFrameCanvas(compositeFrame(frames[i])); if (!canvas) continue;
        const dataUrl = canvas.toDataURL(mimeType).split(',')[1];
        zip.file(`${projectName}_${String(i + 1).padStart(3, '0')}.${extension}`, dataUrl, { base64: true });
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a'); link.download = `${projectName}_sequence_${extension}.zip`; link.href = URL.createObjectURL(content); link.click();
    } else if (format === 'gif') {
      try {
        const workerResponse = await fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js');
        const workerBlob = await workerResponse.blob(); const workerUrl = URL.createObjectURL(workerBlob);
        const gif = new GIF({ workers: 2, quality: 1, width: width, height: height, workerScript: workerUrl, transparent: 'rgba(0,0,0,0)' });
        frames.forEach((frame) => { const canvas = getFrameCanvas(compositeFrame(frame)); if (canvas) gif.addFrame(canvas, { delay: 1000 / fps, copy: true }); });
        gif.on('finished', (blob: Blob) => { const link = document.createElement('a'); link.download = `${projectName}.gif`; link.href = URL.createObjectURL(blob); link.click(); URL.revokeObjectURL(workerUrl); });
        gif.render();
      } catch (err) { alert('Error al generar el GIF.'); }
    } else if (format === 'mp4') {
      const durationInput = prompt('¿Duración de la captura (segundos)?', '6');
      if (durationInput === null) return;
      const duration = Math.max(1, Math.min(60, parseFloat(durationInput) || 6)) * 1000;

      const exportWidth = 512;
      const exportHeight = 512;
      const recordCanvas = document.createElement('canvas');
      recordCanvas.width = exportWidth;
      recordCanvas.height = exportHeight;
      const recordCtx = recordCanvas.getContext('2d')!;
      recordCtx.imageSmoothingEnabled = false;

      const ctx = initAudio();
      const audioDest = ctx.createMediaStreamDestination();
      if (masterGain.current) {
        masterGain.current.connect(audioDest);
      }

      const canvasStream = recordCanvas.captureStream(60);
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks()
      ]);

      const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
      const mediaRecorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 5000000 });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        if (masterGain.current) {
          masterGain.current.disconnect(audioDest);
        }
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${projectName}.${mimeType === 'video/mp4' ? 'mp4' : 'webm'}`;
        link.click();
      };

      mediaRecorder.start();

      const startTime = Date.now();
      const sourceCanvas = document.querySelector('.canvas-container canvas') as HTMLCanvasElement | null;

      const renderLoop = () => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= duration) {
          mediaRecorder.stop();
          return;
        }

        recordCtx.fillStyle = canvasBgColor;
        recordCtx.fillRect(0, 0, exportWidth, exportHeight);
        if (sourceCanvas) {
          recordCtx.imageSmoothingEnabled = false;
          recordCtx.drawImage(sourceCanvas, 0, 0, exportWidth, exportHeight);
        }
        if (exportWithGrid) drawGrid(recordCtx, exportWidth, exportHeight);

        requestAnimationFrame(renderLoop);
      };

      renderLoop();
    }
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = (e) => setBgImage(e.target?.result as string); reader.readAsDataURL(file);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); handleRedo(); }
      else if (e.key === 'b') setCurrentTool('brush');
      else if (e.key === 'e') setCurrentTool('eraser');
      else if (e.key === 'f') setCurrentTool('fill');
      else if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, isFullscreen]);

  if (isMobile && !isFullscreen) {
    const canvasStyle = {
      '--canvas-aspect': `${width} / ${height}`,
      '--canvas-aspect-num': String(width / height),
    } as React.CSSProperties;
    const handleStartTap = () => {
      const ctx = initAudio();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      setAudioUnlocked(true);
    };
    return (
      <div className={`app-container ${darkMode ? 'dark-mode' : ''} mobile-layout`}>
        {!audioUnlocked && (
          <div className="mobile-start-overlay" onClick={handleStartTap}>
            {showUpdateDot && <span className="mobile-start-update-dot" title="Versión actualizada" />}
            <div className="mobile-start-text">
              <div className="mobile-start-title">8-BIT ANIMATE</div>
              <div className="mobile-start-sub">{getByWord()} Maldo</div>
              <div className="mobile-start-hint">{getStartHint()}</div>
            </div>
          </div>
        )}
        <div className="mobile-top-bar">
          <button onClick={handleUndo} disabled={!canUndo} className="mobile-icon-btn" title="Deshacer">↶</button>
          <button onClick={handleRedo} disabled={!canRedo} className="mobile-icon-btn" title="Rehacer">↷</button>
          <div className="mobile-tools-divider" />
          <button className={`mobile-icon-btn ${currentTool === 'brush' ? 'active' : ''}`} onClick={() => setCurrentTool('brush')} title="Pincel">
            <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
              <path d="M497.9 142.1l-46.1 46.1c-4.7 4.7-12.3 4.7-17 0l-111-111c-4.7-4.7-4.7-12.3 0-17l46.1-46.1c18.7-18.7 49.1-18.7 67.9 0l60.1 60.1c18.8 18.7 18.8 49.1 0 67.9zM284.2 99.8L21.6 362.4.4 483.9c-2.9 16.4 11.4 30.6 27.8 27.8l121.5-21.3 262.6-262.6c4.7-4.7 4.7-12.3 0-17l-111-111c-4.8-4.7-12.4-4.7-17.1 0zM124.1 339.9c-5.5-5.5-5.5-14.3 0-19.8l154-154c5.5-5.5 14.3-5.5 19.8 0s5.5 14.3 0 19.8l-154 154c-5.5 5.5-14.3 5.5-19.8 0zM88 424h48v36.3l-64.5 11.3-31.1-31.1L51.7 376H88v48z"/>
            </svg>
          </button>
          <button className={`mobile-icon-btn ${currentTool === 'eraser' ? 'active' : ''}`} onClick={() => setCurrentTool('eraser')} title="Goma">
            <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
              <path d="M497.941 273.941c18.745-18.745 18.745-49.137 0-67.882l-160-160c-18.745-18.745-49.136-18.746-67.883 0l-256 256c-18.745 18.745-18.745 49.137 0 67.882l96 96A48.004 48.004 0 0 0 144 480h356c6.627 0 12-5.373 12-12v-40c0-6.627-5.373-12-12-12H355.883l142.058-142.059zm-302.627-62.627l137.373 137.373L265.373 416H150.628l-80-80 124.686-124.686z"/>
            </svg>
          </button>
          <button className={`mobile-icon-btn ${currentTool === 'fill' ? 'active' : ''}`} onClick={() => setCurrentTool('fill')} title="Relleno">
            <svg width="18" height="18" viewBox="0 0 576 512" fill="currentColor" aria-hidden="true">
              <path d="M512 320s-64 92.65-64 128c0 35.35 28.66 64 64 64s64-28.65 64-64-64-128-64-128zm-9.37-79.43L294.74 32.71c-12.5-12.5-32.76-12.5-45.26 0l-78.06 78.07-72.41-72.41-22.62 22.62 72.41 72.41L17.37 263.43c-12.5 12.5-12.5 32.76 0 45.26l190.86 190.86c12.5 12.5 32.76 12.5 45.26 0l249.14-249.14c12.5-12.51 12.5-32.76 0-45.26zM437.94 256H80l178.97-178.97L437.94 256z"/>
            </svg>
          </button>
          <button className={`mobile-icon-btn ${currentTool === 'eyedropper' ? 'active' : ''}`} onClick={() => setCurrentTool('eyedropper')} title="Gotero">
            <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
              <path d="M50.75 333.25c-12 12-18.75 28.28-18.75 45.26V424L0 480l32 32 56-32h45.49c16.97 0 33.25-6.74 45.25-18.74l129.32-129.32-128-128L50.75 333.25zM483.88 28.12c-37.47-37.5-98.28-37.5-135.75 0l-77.09 77.09-13.1-13.1c-9.44-9.44-24.65-9.31-33.94 0l-40.97 40.97c-9.37 9.37-9.37 24.57 0 33.94l161.94 161.94c9.44 9.44 24.65 9.31 33.94 0L419.88 288c9.37-9.37 9.37-24.57 0-33.94l-13.1-13.1 77.09-77.09c37.51-37.48 37.51-98.28.01-135.75z"/>
            </svg>
          </button>
          {showUpdateDot && <span className="mobile-update-dot" title="Versión actualizada" />}
          <button className="mobile-icon-btn mobile-drawer-btn" onClick={() => setShowInfoDrawer(true)} title="Más opciones">☰</button>
        </div>

        <div
          className="editor-area mobile-canvas-area"
          style={canvasStyle}
          onPointerDown={() => {
            if (paletteExpanded) setPaletteExpanded(false);
            if (timelineExpanded) setTimelineExpanded(false);
            setTutorialStrokes((s) => s + 1);
            markBuildSeen();
          }}
        >
          <PixelCanvas pixels={pixels} setPixels={updatePixels} width={width} height={height} color={currentColor} setColor={setCurrentColor} tool={currentTool} zoom={zoom} showGrid={showGrid} onUndo={handleUndo} onRedo={handleRedo} onHistoryPush={handleHistoryPush} currentFrameIndex={currentFrameIndex} frames={activeLayerFrames} underlayPixels={underlayPixels} onionSkin={onionSkin} bgImage={bgImage} bgTransform={bgTransform} setBgTransform={setBgTransform} isEditingBg={isEditingBg} isPlaying={isPlaying} playPixelSound={activeLayer === 'melody' ? playSingleNote : playPercussionSingle} isRecording={isRecording} canvasBgColor={canvasBgColor} />
        </div>

        <div className="mobile-bottom-stack">
          <div className="mobile-strip mobile-palette-strip">
            <button
              className="mobile-current-color"
              style={{ background: currentColor }}
              onClick={() => setPaletteExpanded((v) => !v)}
              title="Paleta"
            />
            <div className="mobile-strip-swatches">
              {FULL_PALETTE.slice(0, 12).map(c => (
                <Swatch
                  key={c}
                  color={c}
                  selected={currentColor.toLowerCase() === c.toLowerCase()}
                  onSelect={() => selectColor(c)}
                  onLongPress={() => setCanvasBgColor(c)}
                />
              ))}
            </div>
            <button className="mobile-expand-btn" onClick={() => setPaletteExpanded((v) => !v)} title={paletteExpanded ? 'Cerrar paleta' : 'Expandir paleta'}>
              {paletteExpanded ? '▾' : '▴'}
            </button>
          </div>

          <div className="mobile-strip mobile-timeline-strip">
            <button
              className={`rec-button ${isRecording ? 'active' : ''}`}
              onClick={() => setIsRecording(!isRecording)}
              title={isRecording ? 'REC: ON' : 'REC: OFF'}
            >●</button>
            <button
              className={`play-button ${isPlaying ? 'active' : ''} ${highlightPlay ? 'tutorial-highlight' : ''}`}
              onClick={() => {
                if (!isPlaying) setTutorialPlayedOnce(true);
                setIsPlaying(!isPlaying);
              }}
            >{isPlaying ? 'Ⅱ' : '▶'}</button>
            <button
              className={`onion-button ${onionSkin > 0 ? 'active' : ''}`}
              onClick={() => setOnionSkin((onionSkin + 1) % 5)}
              title="Papel Cebolla"
            >◎{onionSkin > 0 ? onionSkin : ''}</button>
            <span className="mobile-frame-count">{currentFrameIndex + 1}/{frames.length}</span>
            <div className="mobile-strip-frames">
              {frames.map((_, i) => (
                <button
                  key={i}
                  className={`mobile-frame-dot ${i === currentFrameIndex ? 'active' : ''}`}
                  onClick={() => { setCurrentFrameIndex(i); playFrameSound(frames[i]); }}
                />
              ))}
            </div>
            <button className={`mobile-add-frame-btn ${highlightAddFrame ? 'tutorial-highlight' : ''}`} onClick={addFrame} disabled={frames.length >= MAX_FRAMES} title="Agregar frame">+</button>
            <button className="mobile-expand-btn" onClick={() => setTimelineExpanded((v) => !v)} title={timelineExpanded ? 'Cerrar timeline' : 'Expandir timeline'}>
              {timelineExpanded ? '▾' : '▴'}
            </button>
          </div>
        </div>

        {paletteExpanded && (
          <div className="mobile-sheet mobile-palette-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-sheet-header">
              <h3>Paleta</h3>
              <input
                type="color"
                value={currentColor}
                onChange={(e) => setCurrentColor(e.target.value)}
                className="mobile-color-picker"
                title="Color personalizado"
              />
              <button className="mobile-sheet-close" onClick={() => setPaletteExpanded(false)}>×</button>
            </div>
            <div className="mobile-palette-grid">
              {FULL_PALETTE.map(c => (
                <Swatch
                  key={c}
                  color={c}
                  selected={currentColor.toLowerCase() === c.toLowerCase()}
                  onSelect={() => selectColor(c)}
                  onLongPress={() => setCanvasBgColor(c)}
                />
              ))}
            </div>
          </div>
        )}

        {timelineExpanded && (
          <div className="mobile-sheet mobile-timeline-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-sheet-header">
              <h3>Timeline</h3>
              <button className="mobile-sheet-close" onClick={() => setTimelineExpanded(false)}>×</button>
            </div>
            <Timeline
              frames={frames}
              activeLayer={activeLayer}
              currentFrameIndex={currentFrameIndex}
              setCurrentFrameIndex={setCurrentFrameIndex}
              addFrame={addFrame}
              removeFrame={removeFrame}
              duplicateFrame={duplicateFrame}
              clearFrame={clearFrame}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              fps={fps}
              setFps={setFps}
              width={width}
              height={height}
              onionSkin={onionSkin}
              setOnionSkin={setOnionSkin}
              moveFrame={moveFrame}
              playFrameSound={playFrameSound}
              lastAddedIndex={lastAddedIndex}
              isRecording={isRecording}
              setIsRecording={setIsRecording}
              hideMainPlayback
              fpsControl={
                <button
                  className={`mobile-fps-btn ${fpsDragOrigin ? 'adjusting' : ''}`}
                  title="Velocidad (mantener y deslizar arriba/abajo)"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setFpsDragOrigin({ y: e.clientY, fps });
                  }}
                  onPointerMove={(e) => {
                    if (!fpsDragOrigin) return;
                    const delta = fpsDragOrigin.y - e.clientY;
                    const next = Math.max(1, Math.min(30, fpsDragOrigin.fps + Math.round(delta / 8)));
                    if (next !== fps) setFps(next);
                  }}
                  onPointerUp={(e) => {
                    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
                    setFpsDragOrigin(null);
                  }}
                  onPointerCancel={() => setFpsDragOrigin(null)}
                >
                  ⏱
                  {fpsDragOrigin && (
                    <div className="mobile-fps-popover">
                      <div className="mobile-fps-bar">
                        <div className="mobile-fps-fill" style={{ height: `${((fps - 1) / 29) * 100}%` }} />
                      </div>
                      <div className="mobile-fps-value">{fps}<span className="mobile-fps-label">FPS</span></div>
                    </div>
                  )}
                </button>
              }
            />
          </div>
        )}

        {isImporting && <ImageImporter width={width} height={height} palette={FULL_PALETTE} onImport={handleImport} onCancel={() => setIsImporting(false)} />}

        {showInfoDrawer && (
          <div className="mobile-drawer-backdrop" onClick={() => setShowInfoDrawer(false)}>
            <aside className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="mobile-drawer-header">
                <input
                  type="text"
                  className="project-name-input"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Nombre..."
                />
                <button className="mobile-drawer-close" onClick={() => setShowInfoDrawer(false)}>×</button>
              </div>
              <div className="mobile-drawer-section">
                <h3>Modo</h3>
                <div className="panel-mode-controls">
                  <div className="layer-toggle" role="group" aria-label="Modo de capa">
                    <button className={activeLayer === 'melody' ? 'active' : ''} onClick={() => setActiveLayer('melody')} title="Modo Melodía" aria-label="Modo Melodía"><MelodyIcon /></button>
                    <button className={activeLayer === 'percussion' ? 'active' : ''} onClick={() => setActiveLayer('percussion')} title="Modo Ritmo" aria-label="Modo Ritmo"><PercussionIcon /></button>
                  </div>
                  <button
                    className={`slide-toggle ${slideMode ? 'active' : ''}`}
                    onClick={() => setSlideMode(v => !v)}
                    title="Lo que pintes en melodía con esto activo tendrá glide/portamento entre frames"
                  >
                    {slideMode ? '◉ Glide ON' : '○ Glide OFF'}
                  </button>
                </div>
              </div>
              <div className="mobile-drawer-section">
                <h3>Archivo</h3>
                <div className="mobile-drawer-buttons">
                  <button onClick={() => { handleNew(); setShowInfoDrawer(false); }}>Nuevo</button>
                  <button onClick={() => { handleOpen(); setShowInfoDrawer(false); }}>Abrir</button>
                  <button onClick={() => { setIsImporting(true); setShowInfoDrawer(false); }}>Importar</button>
                  <button onClick={() => { handleSave(); setShowInfoDrawer(false); }}>Guardar</button>
                </div>
              </div>
              <div className="mobile-drawer-section">
                <h3>Exportar</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <input type="checkbox" checked={exportWithGrid} onChange={(e) => setExportWithGrid(e.target.checked)} />
                  Incluir grilla
                </label>
                <div className="mobile-drawer-buttons">
                  <button onClick={() => { handleExport('mp4'); setShowInfoDrawer(false); }}>Video MP4</button>
                  <button onClick={() => { handleExport('gif'); setShowInfoDrawer(false); }}>GIF</button>
                  <button onClick={() => { handleExport('png-seq'); setShowInfoDrawer(false); }}>PNG ZIP</button>
                  <button onClick={() => { handleExport('jpg-seq'); setShowInfoDrawer(false); }}>JPG ZIP</button>
                  <button onClick={() => { handleExport('png'); setShowInfoDrawer(false); }}>Frame PNG</button>
                </div>
              </div>
              <div className="mobile-drawer-section">
                <h3>Vista</h3>
                <label><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Grilla</label>
                <div className="zoom-controls">
                  <span>Zoom: {zoom}x</span>
                  <button onClick={() => setZoom(Math.max(1, zoom - 1))}>-</button>
                  <button onClick={() => setZoom(Math.min(50, zoom + 1))}>+</button>
                </div>
                <label><input type="checkbox" checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} /> Modo oscuro</label>
                <label><input type="checkbox" checked={audioEnabled} onChange={(e) => setAudioEnabled(e.target.checked)} /> Audio</label>
              </div>
              <div className="mobile-drawer-section">
                <h3>Información</h3>
                <p>Frames: {frames.length} / {MAX_FRAMES}</p>
                <p>Frame actual: {currentFrameIndex + 1}</p>
                <p>Lienzo: {width} x {height}</p>
              </div>
              <div className="mobile-drawer-section">
                <h3>Mover Capa</h3>
                <div className="shift-cross">
                  <button className="up" onClick={() => shiftPixels(0, -1)}>↑</button>
                  <button className="left" onClick={() => shiftPixels(-1, 0)}>←</button>
                  <button className="right" onClick={() => shiftPixels(1, 0)}>→</button>
                  <button className="down" onClick={() => shiftPixels(0, 1)}>↓</button>
                </div>
              </div>
              <div className="mobile-drawer-section bg-panel">
                <h3>Imagen Referencia</h3>
                {!bgImage ? (
                  <div className="file-input-container">
                    <input type="file" accept="image/*" onChange={handleBgUpload} />
                    <span className="file-custom-text">No file</span>
                  </div>
                ) : (
                  <div className="bg-controls">
                    <button className={isEditingBg ? 'active' : ''} onClick={() => setIsEditingBg(!isEditingBg)}>{isEditingBg ? '✅ Guardar' : '🎯 Ajustar'}</button>
                    <label>Opacidad: <input type="range" min="0" max="1" step="0.1" value={bgTransform.opacity} onChange={e => setBgTransform({ ...bgTransform, opacity: parseFloat(e.target.value) })} /></label>
                    <label>Zoom: <input type="range" min="0.1" max="5" step="0.1" value={bgTransform.scale} onChange={e => setBgTransform({ ...bgTransform, scale: parseFloat(e.target.value) })} /></label>
                    <label>Girar: <input type="range" min="0" max="360" step="1" value={bgTransform.rotation} onChange={e => setBgTransform({ ...bgTransform, rotation: parseInt(e.target.value) })} /></label>
                    <button onClick={() => setBgImage(null)} className="danger">Quitar</button>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`app-container ${darkMode ? 'dark-mode' : ''} ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      {!isFullscreen && (
        <header>
          <div className="logo-container"><div className="logo">8-BIT ANIMATE</div><span className="signature">by maldo</span></div>
          <div className="project-name-container">
            <input
              type="text"
              className="project-name-input"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Nombre..."
            />
            {showUpdateDot && <span className="desktop-update-dot" title="Versión actualizada" />}
          </div>
          <TopMenu onUndo={handleUndo} onRedo={handleRedo} canUndo={canUndo} canRedo={canRedo} onSave={handleSave} onOpen={handleOpen} onExport={handleExport} onNew={handleNew} onImport={() => setIsImporting(true)} showGrid={showGrid} setShowGrid={setShowGrid} zoom={zoom} setZoom={setZoom} darkMode={darkMode} setDarkMode={setDarkMode} audioEnabled={audioEnabled} setAudioEnabled={setAudioEnabled} isFullscreen={isFullscreen} setIsFullscreen={setIsFullscreen} exportWithGrid={exportWithGrid} setExportWithGrid={setExportWithGrid} />
        </header>
      )}
      <main>
        {!isFullscreen && <Toolbar currentTool={currentTool} setTool={setCurrentTool} currentColor={currentColor} setColor={setCurrentColor} selectColor={selectColor} setCanvasBgColor={setCanvasBgColor} />}
        <div className="editor-area">
          {isFullscreen && (
            <button className="exit-fullscreen-btn" onClick={() => setIsFullscreen(false)}>
              Salir Pantalla Completa (Esc)
            </button>
          )}
          <PixelCanvas pixels={pixels} setPixels={updatePixels} width={width} height={height} color={currentColor} setColor={setCurrentColor} tool={currentTool} zoom={zoom} showGrid={showGrid} onUndo={handleUndo} onRedo={handleRedo} onHistoryPush={handleHistoryPush} currentFrameIndex={currentFrameIndex} frames={activeLayerFrames} underlayPixels={underlayPixels} onionSkin={onionSkin} bgImage={bgImage} bgTransform={bgTransform} setBgTransform={setBgTransform} isEditingBg={isEditingBg} isPlaying={isPlaying} playPixelSound={activeLayer === 'melody' ? playSingleNote : playPercussionSingle} isRecording={isRecording} canvasBgColor={canvasBgColor} />
        </div>
        {isImporting && <ImageImporter width={width} height={height} palette={FULL_PALETTE} onImport={handleImport} onCancel={() => setIsImporting(false)} />}
        {!isFullscreen && (
          <aside className="info-panel">
            <div className="panel-mode-controls">
              <div className="layer-toggle" role="group" aria-label="Modo de capa">
                <button className={activeLayer === 'melody' ? 'active' : ''} onClick={() => setActiveLayer('melody')} title="Modo Melodía" aria-label="Modo Melodía"><MelodyIcon /></button>
                <button className={activeLayer === 'percussion' ? 'active' : ''} onClick={() => setActiveLayer('percussion')} title="Modo Ritmo" aria-label="Modo Ritmo"><PercussionIcon /></button>
              </div>
              <button
                className={`slide-toggle ${slideMode ? 'active' : ''}`}
                onClick={() => setSlideMode(v => !v)}
                title="Lo que pintes en melodía con esto activo tendrá glide/portamento entre frames"
              >
                {slideMode ? '◉ Glide ON' : '○ Glide OFF'}
              </button>
            </div>
            <h3>Información</h3><p>Frames: {frames.length} / {MAX_FRAMES}</p><p>Frame actual: {currentFrameIndex + 1}</p><p>Lienzo: {width} x {height}</p>
            <div className="shift-controls"><h3>Mover Capa</h3><div className="shift-cross"><button className="up" onClick={() => shiftPixels(0, -1)}>↑</button><button className="left" onClick={() => shiftPixels(-1, 0)}>←</button><button className="right" onClick={() => shiftPixels(1, 0)}>→</button><button className="down" onClick={() => shiftPixels(0, 1)}>↓</button></div></div>
            <div className="bg-panel"><h3>Imagen Referencia</h3>{!bgImage ? ( <div className="file-input-container"><input type="file" accept="image/*" onChange={handleBgUpload} /><span className="file-custom-text">No file</span></div> ) : ( <div className="bg-controls"><button className={isEditingBg ? 'active' : ''} onClick={() => setIsEditingBg(!isEditingBg)}>{isEditingBg ? '✅ Guardar' : '🎯 Ajustar'}</button><label>Opacidad: <input type="range" min="0" max="1" step="0.1" value={bgTransform.opacity} onChange={e => setBgTransform({...bgTransform, opacity: parseFloat(e.target.value)})} /></label><label>Zoom: <input type="range" min="0.1" max="5" step="0.1" value={bgTransform.scale} onChange={e => setBgTransform({...bgTransform, scale: parseFloat(e.target.value)})} /></label><label>Girar: <input type="range" min="0" max="360" step="1" value={bgTransform.rotation} onChange={e => setBgTransform({...bgTransform, rotation: parseInt(e.target.value)})} /></label><button onClick={() => setBgImage(null)} className="danger">Quitar</button></div> )}</div>

            <div className="shortcuts"><p><strong>B</strong>: Pincel | <strong>E</strong>: Goma</p><p><strong>F</strong>: Relleno | <strong>Alt+Click</strong>: Gotero</p></div>
          </aside>
        )}
      </main>
      {!isFullscreen && <Timeline frames={frames} activeLayer={activeLayer} currentFrameIndex={currentFrameIndex} setCurrentFrameIndex={setCurrentFrameIndex} addFrame={addFrame} removeFrame={removeFrame} duplicateFrame={duplicateFrame} clearFrame={clearFrame} isPlaying={isPlaying} setIsPlaying={setIsPlaying} fps={fps} setFps={setFps} width={width} height={height} onionSkin={onionSkin} setOnionSkin={setOnionSkin} moveFrame={moveFrame} playFrameSound={playFrameSound} lastAddedIndex={lastAddedIndex} isRecording={isRecording} setIsRecording={setIsRecording} />}
    </div>
  );
}

export default App;
