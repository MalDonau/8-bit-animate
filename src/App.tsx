import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import PixelCanvas from './components/PixelCanvas';
import Toolbar, { DB32_PALETTE, EXTRA_COLORS } from './components/Toolbar';
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
  const [frames, setFrames] = useState<string[][]>([
    Array(DEFAULT_WIDTH * DEFAULT_HEIGHT).fill('transparent')
  ]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);

  const framesRef = useRef(frames);
  useEffect(() => { framesRef.current = frames; }, [frames]);

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
    return { s, l };
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
      const framePixels = framesRef.current[currentFrameIndex];
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

  const playFrameSound = useCallback((framePixels: string[]) => {
    const pixelsByRow: Map<number, {color: string, x: number}[]> = new Map();
    const colorCounts: Map<string, number> = new Map();
    framePixels.forEach((color, i) => {
      if (color !== 'transparent' && color.toLowerCase() !== '#ffffff') {
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
        const volume = 0.03;
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

  useEffect(() => {
    let interval: number | undefined;
    if (isPlaying && framesRef.current.length > 1) {
      interval = window.setInterval(() => {
        setCurrentFrameIndex((prev) => {
          const next = (prev + 1) % framesRef.current.length;
          playFrameSound(framesRef.current[next]);
          return next;
        });
      }, 1000 / fps);
    }
    return () => window.clearInterval(interval);
  }, [isPlaying, fps, playFrameSound]);

  const pixels = frames[currentFrameIndex];
  const updatePixels = (newPixels: string[]) => { const newFrames = [...frames]; newFrames[currentFrameIndex] = newPixels; setFrames(newFrames); };
  const handleImport = (importedPixels: string[]) => { const newFrames = [...frames]; newFrames[currentFrameIndex] = importedPixels; setFrames(newFrames); pushState(newFrames); setIsImporting(false); };
  const handleHistoryPush = (pixelsToPush: string[]) => { const newFrames = [...frames]; newFrames[currentFrameIndex] = pixelsToPush; pushState(newFrames); };
  const handleUndo = () => { const prevState = undo(); if (prevState) { setFrames(prevState); if (currentFrameIndex >= prevState.length) setCurrentFrameIndex(prevState.length - 1); } };
  const handleRedo = () => { const nextState = redo(); if (nextState) { setFrames(nextState); if (currentFrameIndex >= nextState.length) setCurrentFrameIndex(nextState.length - 1); } };
  const handleNew = () => { if (confirm('¿Estás seguro?')) { const emptyFrames = [Array(width * height).fill('transparent')]; setFrames(emptyFrames); setProjectName('animate'); setCurrentFrameIndex(0); reset(emptyFrames); } };
  
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
          setWidth(content.width);
          setHeight(content.height);
          if (content.frames) {
            setFrames(content.frames);
            reset(content.frames);
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
    const emptyFrame = Array(width * height).fill('transparent'); 
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
    const duplicatedFrame = [...frames[currentFrameIndex]]; 
    const nextIdx = currentFrameIndex + 1;
    newFrames.splice(nextIdx, 0, duplicatedFrame); 
    setFrames(newFrames); 
    setCurrentFrameIndex(nextIdx); 
    setLastAddedIndex(nextIdx);
    setTimeout(() => setLastAddedIndex(null), 600);
    pushState(newFrames); 
  };
  const removeFrame = () => { if (frames.length <= 1) return; const newFrames = frames.filter((_, i) => i !== currentFrameIndex); setFrames(newFrames); setCurrentFrameIndex(Math.max(0, currentFrameIndex - 1)); pushState(newFrames); };
  const shiftPixels = (dx: number, dy: number) => { const newPixels = Array(width * height).fill('transparent'); const currentPixels = frames[currentFrameIndex]; for (let y = 0; y < height; y++) { for (let x = 0; x < width; x++) { const nx = x + dx; const ny = y + dy; if (nx >= 0 && nx < width && ny >= 0 && ny < height) { newPixels[ny * width + nx] = currentPixels[y * width + x]; } } } const newFrames = [...frames]; newFrames[currentFrameIndex] = newPixels; setFrames(newFrames); pushState(newFrames); };

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
            ctx.fillStyle = '#ffffff'; 
            ctx.fillRect(x * pixelSizeX, y * pixelSizeY, pixelSizeX, pixelSizeY); 
          } 
          return; 
        }
        ctx.fillStyle = color; 
        ctx.fillRect(x * pixelSizeX, y * pixelSizeY, pixelSizeX, pixelSizeY);
      });
      return canvas;
    };
    if (format === 'png') {
      const canvas = getFrameCanvas(frames[currentFrameIndex]); if (!canvas) return;
      const link = document.createElement('a'); link.download = `${projectName}_frame_${currentFrameIndex + 1}.png`; link.href = canvas.toDataURL('image/png'); link.click();
    } else if (format === 'png-seq' || format === 'jpg-seq') {
      const extension = format === 'png-seq' ? 'png' : 'jpg';
      const mimeType = format === 'png-seq' ? 'image/png' : 'image/jpeg';
      for (let i = 0; i < frames.length; i++) {
        const canvas = getFrameCanvas(frames[i]); if (!canvas) continue;
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
        frames.forEach((frame) => { const canvas = getFrameCanvas(frame); if (canvas) gif.addFrame(canvas, { delay: 1000 / fps, copy: true }); });
        gif.on('finished', (blob: Blob) => { const link = document.createElement('a'); link.download = `${projectName}.gif`; link.href = URL.createObjectURL(blob); link.click(); URL.revokeObjectURL(workerUrl); });
        gif.render();
      } catch (err) { alert('Error al generar el GIF.'); }
    } else if (format === 'mp4') {
      const exportWidth = 512;
      const exportHeight = 512;
      const recordCanvas = document.createElement('canvas');
      recordCanvas.width = exportWidth;
      recordCanvas.height = exportHeight;
      const recordCtx = recordCanvas.getContext('2d')!;
      
      const ctx = initAudio();
      const audioDest = ctx.createMediaStreamDestination();
      if (masterGain.current) {
        masterGain.current.connect(audioDest);
      }

      const canvasStream = recordCanvas.captureStream(fps);
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

      const duration = 6000; // 6 seconds
      const startTime = Date.now();
      let lastFrameIdx = -1;
      
      const renderLoop = () => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= duration) {
          mediaRecorder.stop();
          return;
        }

        const totalFramesInAnimation = frames.length;
        const frameDuration = 1000 / fps;
        const currentFrameIdx = Math.floor((elapsed / frameDuration) % totalFramesInAnimation);
        
        if (currentFrameIdx !== lastFrameIdx) {
          playFrameSound(frames[currentFrameIdx]);
          lastFrameIdx = currentFrameIdx;
        }

        const frameCanvas = getFrameCanvas(frames[currentFrameIdx], exportWidth, exportHeight);
        if (frameCanvas) {
          recordCtx.clearRect(0, 0, exportWidth, exportHeight);
          recordCtx.drawImage(frameCanvas, 0, 0);
        }
        
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
    const canvasStyle = { '--canvas-aspect': `${width} / ${height}` } as React.CSSProperties;
    return (
      <div className={`app-container ${darkMode ? 'dark-mode' : ''} mobile-layout`}>
        <div className="mobile-top-bar">
          <button onClick={handleUndo} disabled={!canUndo} className="mobile-icon-btn" title="Deshacer">↶</button>
          <button onClick={handleRedo} disabled={!canRedo} className="mobile-icon-btn" title="Rehacer">↷</button>
          <div className="mobile-tools-divider" />
          <button className={`mobile-icon-btn ${currentTool === 'brush' ? 'active' : ''}`} onClick={() => setCurrentTool('brush')} title="Pincel">✎</button>
          <button className={`mobile-icon-btn ${currentTool === 'eraser' ? 'active' : ''}`} onClick={() => setCurrentTool('eraser')} title="Goma">□</button>
          <button className={`mobile-icon-btn ${currentTool === 'fill' ? 'active' : ''}`} onClick={() => setCurrentTool('fill')} title="Relleno">
            <svg width="18" height="18" viewBox="0 0 576 512" fill="currentColor" aria-hidden="true">
              <path d="M512 320s-64 92.65-64 128c0 35.35 28.66 64 64 64s64-28.65 64-64-64-128-64-128zm-9.37-79.43L294.74 32.71c-12.5-12.5-32.76-12.5-45.26 0l-78.06 78.07-72.41-72.41-22.62 22.62 72.41 72.41L17.37 263.43c-12.5 12.5-12.5 32.76 0 45.26l190.86 190.86c12.5 12.5 32.76 12.5 45.26 0l249.14-249.14c12.5-12.51 12.5-32.76 0-45.26zM437.94 256H80l178.97-178.97L437.94 256z"/>
            </svg>
          </button>
          <button className={`mobile-icon-btn ${currentTool === 'eyedropper' ? 'active' : ''}`} onClick={() => setCurrentTool('eyedropper')} title="Gotero">✛</button>
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
          <PixelCanvas pixels={pixels} setPixels={updatePixels} width={width} height={height} color={currentColor} setColor={setCurrentColor} tool={currentTool} zoom={zoom} showGrid={showGrid} onUndo={handleUndo} onRedo={handleRedo} onHistoryPush={handleHistoryPush} currentFrameIndex={currentFrameIndex} frames={frames} onionSkin={onionSkin} bgImage={bgImage} bgTransform={bgTransform} setBgTransform={setBgTransform} isEditingBg={isEditingBg} isPlaying={isPlaying} playPixelSound={playSingleNote} isRecording={isRecording} />
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
                <div
                  key={c}
                  className={`palette-color ${currentColor.toLowerCase() === c.toLowerCase() ? 'selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setCurrentColor(c)}
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
                <div
                  key={c}
                  className={`palette-color ${currentColor.toLowerCase() === c.toLowerCase() ? 'selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setCurrentColor(c)}
                  title={c}
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
              currentFrameIndex={currentFrameIndex}
              setCurrentFrameIndex={setCurrentFrameIndex}
              addFrame={addFrame}
              removeFrame={removeFrame}
              duplicateFrame={duplicateFrame}
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
          <TopMenu onUndo={handleUndo} onRedo={handleRedo} canUndo={canUndo} canRedo={canRedo} onSave={handleSave} onOpen={handleOpen} onExport={handleExport} onNew={handleNew} onImport={() => setIsImporting(true)} showGrid={showGrid} setShowGrid={setShowGrid} zoom={zoom} setZoom={setZoom} darkMode={darkMode} setDarkMode={setDarkMode} audioEnabled={audioEnabled} setAudioEnabled={setAudioEnabled} isFullscreen={isFullscreen} setIsFullscreen={setIsFullscreen} />
        </header>
      )}
      <main>
        {!isFullscreen && <Toolbar currentTool={currentTool} setTool={setCurrentTool} currentColor={currentColor} setColor={setCurrentColor} />}
        <div className="editor-area">
          {isFullscreen && (
            <button className="exit-fullscreen-btn" onClick={() => setIsFullscreen(false)}>
              Salir Pantalla Completa (Esc)
            </button>
          )}
          <PixelCanvas pixels={pixels} setPixels={updatePixels} width={width} height={height} color={currentColor} setColor={setCurrentColor} tool={currentTool} zoom={zoom} showGrid={showGrid} onUndo={handleUndo} onRedo={handleRedo} onHistoryPush={handleHistoryPush} currentFrameIndex={currentFrameIndex} frames={frames} onionSkin={onionSkin} bgImage={bgImage} bgTransform={bgTransform} setBgTransform={setBgTransform} isEditingBg={isEditingBg} isPlaying={isPlaying} playPixelSound={playSingleNote} isRecording={isRecording} />
        </div>
        {isImporting && <ImageImporter width={width} height={height} palette={FULL_PALETTE} onImport={handleImport} onCancel={() => setIsImporting(false)} />}
        {!isFullscreen && (
          <aside className="info-panel">
            <h3>Información</h3><p>Frames: {frames.length} / {MAX_FRAMES}</p><p>Frame actual: {currentFrameIndex + 1}</p><p>Lienzo: {width} x {height}</p>
            <div className="shift-controls"><h3>Mover Capa</h3><div className="shift-cross"><button className="up" onClick={() => shiftPixels(0, -1)}>↑</button><button className="left" onClick={() => shiftPixels(-1, 0)}>←</button><button className="right" onClick={() => shiftPixels(1, 0)}>→</button><button className="down" onClick={() => shiftPixels(0, 1)}>↓</button></div></div>
            <div className="bg-panel"><h3>Imagen Referencia</h3>{!bgImage ? ( <div className="file-input-container"><input type="file" accept="image/*" onChange={handleBgUpload} /><span className="file-custom-text">No file</span></div> ) : ( <div className="bg-controls"><button className={isEditingBg ? 'active' : ''} onClick={() => setIsEditingBg(!isEditingBg)}>{isEditingBg ? '✅ Guardar' : '🎯 Ajustar'}</button><label>Opacidad: <input type="range" min="0" max="1" step="0.1" value={bgTransform.opacity} onChange={e => setBgTransform({...bgTransform, opacity: parseFloat(e.target.value)})} /></label><label>Zoom: <input type="range" min="0.1" max="5" step="0.1" value={bgTransform.scale} onChange={e => setBgTransform({...bgTransform, scale: parseFloat(e.target.value)})} /></label><label>Girar: <input type="range" min="0" max="360" step="1" value={bgTransform.rotation} onChange={e => setBgTransform({...bgTransform, rotation: parseInt(e.target.value)})} /></label><button onClick={() => setBgImage(null)} className="danger">Quitar</button></div> )}</div>

            <div className="shortcuts"><p><strong>B</strong>: Pincel | <strong>E</strong>: Goma</p><p><strong>F</strong>: Relleno | <strong>Alt+Click</strong>: Gotero</p></div>
          </aside>
        )}
      </main>
      {!isFullscreen && <Timeline frames={frames} currentFrameIndex={currentFrameIndex} setCurrentFrameIndex={setCurrentFrameIndex} addFrame={addFrame} removeFrame={removeFrame} duplicateFrame={duplicateFrame} isPlaying={isPlaying} setIsPlaying={setIsPlaying} fps={fps} setFps={setFps} width={width} height={height} onionSkin={onionSkin} setOnionSkin={setOnionSkin} moveFrame={moveFrame} playFrameSound={playFrameSound} lastAddedIndex={lastAddedIndex} isRecording={isRecording} setIsRecording={setIsRecording} />}
    </div>
  );
}

export default App;
