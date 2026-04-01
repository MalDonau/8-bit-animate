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

const BASE_FREQ = 65.41; // C2

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

function App() {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
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
  const [isRecording, setIsRecording] = useState(false);
  const [onionSkin, setOnionSkin] = useState(0);
  const [darkMode, setDarkMode] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Audio Refs
  const audioCtx = useRef<AudioContext | null>(null);
  const delayNode = useRef<DelayNode | null>(null);
  const feedbackNode = useRef<GainNode | null>(null);
  const filterNode = useRef<BiquadFilterNode | null>(null);

  const initAudio = useCallback(() => {
    if (audioCtx.current) return audioCtx.current;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const dNode = ctx.createDelay(3.0);
    const fNode = ctx.createGain();
    const lpfNode = ctx.createBiquadFilter();
    
    lpfNode.type = 'lowpass';
    lpfNode.frequency.value = 1000;
    lpfNode.Q.value = 0.7;

    dNode.delayTime.value = 0.5;
    fNode.gain.value = 0.4;

    // Routing for Echo
    dNode.connect(fNode);
    fNode.connect(dNode);
    dNode.connect(lpfNode); // Echo goes to filter
    
    lpfNode.connect(ctx.destination);

    audioCtx.current = ctx;
    delayNode.current = dNode;
    feedbackNode.current = fNode;
    filterNode.current = lpfNode;
    return ctx;
  }, []);

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

  const playSingleNote = useCallback((row: number, color: string, xPos: number, volumeFactor = 1) => {
    if (!audioEnabled || !color || color === 'transparent' || color.toLowerCase() === '#ffffff') return;
    const ctx = initAudio();
    if (ctx.state === 'suspended') ctx.resume();

    const currentScale = getResultantScale(framesRef.current[currentFrameIndex]);
    const noteFreq = currentScale[31 - row] || 440;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner();

    osc.type = getWaveformByColor(color);
    osc.frequency.setValueAtTime(noteFreq, ctx.currentTime);
    pan.pan.setValueAtTime((xPos / width) * 2 - 1, ctx.currentTime);

    const volume = 0.05 * volumeFactor;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);

    osc.connect(pan);
    pan.connect(gain);
    
    // DRY path
    if (filterNode.current) gain.connect(filterNode.current);
    // WET path (Delay)
    if (onionSkin > 0 && delayNode.current) gain.connect(delayNode.current);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }, [audioEnabled, initAudio, width, onionSkin, currentFrameIndex, getResultantScale]);

  const playFrameSound = useCallback((framePixels: string[]) => {
    const pixelsByRow: Map<number, {color: string, x: number}[]> = new Map();
    framePixels.forEach((color, i) => {
      if (color !== 'transparent' && color.toLowerCase() !== '#ffffff') {
        const row = Math.floor(i / width);
        if (!pixelsByRow.has(row)) pixelsByRow.set(row, []);
        pixelsByRow.get(row)!.push({color, x: i % width});
      }
    });
    const activeRows = Array.from(pixelsByRow.keys());
    if (activeRows.length === 0) return;
    const maxNotes = Math.min(5, activeRows.length);
    const selectedRows = activeRows.sort(() => 0.5 - Math.random()).slice(0, maxNotes);
    selectedRows.forEach(row => {
      const data = pixelsByRow.get(row)![0];
      playSingleNote(row, data.color, data.x, 0.6);
    });
  }, [playSingleNote, width]);

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
    } else if (!isPlaying) {
      setIsRecording(false);
    }
    return () => window.clearInterval(interval);
  }, [isPlaying, fps, playFrameSound]);

  const pixels = frames[currentFrameIndex];
  const updatePixels = (newPixels: string[]) => { const newFrames = [...frames]; newFrames[currentFrameIndex] = newPixels; setFrames(newFrames); };
  const handleImport = (importedPixels: string[]) => { const newFrames = [...frames]; newFrames[currentFrameIndex] = importedPixels; setFrames(newFrames); pushState(newFrames); setIsImporting(false); };
  const handleHistoryPush = (pixelsToPush: string[]) => { const newFrames = [...frames]; newFrames[currentFrameIndex] = pixelsToPush; pushState(newFrames); };
  const handleUndo = () => { const prevState = undo(); if (prevState) { setFrames(prevState); if (currentFrameIndex >= prevState.length) setCurrentFrameIndex(prevState.length - 1); } };
  const handleRedo = () => { const nextState = redo(); if (nextState) { setFrames(nextState); if (currentFrameIndex >= nextState.length) setCurrentFrameIndex(nextState.length - 1); } };
  const handleNew = () => { if (confirm('¿Estás seguro?')) { const emptyFrames = [Array(width * height).fill('transparent')]; setFrames(emptyFrames); setCurrentFrameIndex(0); reset(emptyFrames); } };
  const handleSave = () => { const data = JSON.stringify({ width, height, frames, bgImage, bgTransform: {x:0, y:0, scale:1, rotation:0, opacity:0.5} }); const blob = new Blob([data], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'pixel-art-animation.json'; link.click(); };
  const handleOpen = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'; input.onchange = (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { try { const content = JSON.parse(e.target?.result as string); setWidth(content.width); setHeight(content.height); if (content.frames) { setFrames(content.frames); reset(content.frames); } setCurrentFrameIndex(0); } catch (err) { alert('Error al abrir el archivo.'); } }; reader.readAsText(file); }; input.click(); };
  const addFrame = () => { if (frames.length >= MAX_FRAMES) return; const newFrames = [...frames]; const emptyFrame = Array(width * height).fill('transparent'); newFrames.splice(currentFrameIndex + 1, 0, emptyFrame); setFrames(newFrames); setCurrentFrameIndex(currentFrameIndex + 1); pushState(newFrames); };
  const duplicateFrame = () => { if (frames.length >= MAX_FRAMES) return; const newFrames = [...frames]; const duplicatedFrame = [...frames[currentFrameIndex]]; newFrames.splice(currentFrameIndex + 1, 0, duplicatedFrame); setFrames(newFrames); setCurrentFrameIndex(currentFrameIndex + 1); pushState(newFrames); };
  const removeFrame = () => { if (frames.length <= 1) return; const newFrames = frames.filter((_, i) => i !== currentFrameIndex); setFrames(newFrames); setCurrentFrameIndex(Math.max(0, currentFrameIndex - 1)); pushState(newFrames); };
  const shiftPixels = (dx: number, dy: number) => { const newPixels = Array(width * height).fill('transparent'); const currentPixels = frames[currentFrameIndex]; for (let y = 0; y < height; y++) { for (let x = 0; x < width; x++) { const nx = x + dx; const ny = y + dy; if (nx >= 0 && nx < width && ny >= 0 && ny < height) { newPixels[ny * width + nx] = currentPixels[y * width + x]; } } } const newFrames = [...frames]; newFrames[currentFrameIndex] = newPixels; setFrames(newFrames); pushState(newFrames); };

  const handleExport = async (format: 'png' | 'gif' | 'png-seq' | 'jpg-seq') => {
    const zip = new JSZip();
    const getFrameCanvas = (framePixels: string[]) => {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d'); if (!ctx) return null;
      framePixels.forEach((color, index) => {
        if (color === 'transparent') { if (format === 'jpg-seq') { ctx.fillStyle = '#ffffff'; ctx.fillRect(index % width, Math.floor(index / width), 1, 1); } return; }
        ctx.fillStyle = color; ctx.fillRect(index % width, Math.floor(index / width), 1, 1);
      });
      return canvas;
    };
    if (format === 'png') {
      const canvas = getFrameCanvas(frames[currentFrameIndex]); if (!canvas) return;
      const link = document.createElement('a'); link.download = `frame_${currentFrameIndex + 1}.png`; link.href = canvas.toDataURL('image/png'); link.click();
    } else if (format === 'png-seq' || format === 'jpg-seq') {
      const extension = format === 'png-seq' ? 'png' : 'jpg';
      const mimeType = format === 'png-seq' ? 'image/png' : 'image/jpeg';
      for (let i = 0; i < frames.length; i++) {
        const canvas = getFrameCanvas(frames[i]); if (!canvas) continue;
        const dataUrl = canvas.toDataURL(mimeType).split(',')[1];
        zip.file(`frame_${String(i + 1).padStart(3, '0')}.${extension}`, dataUrl, { base64: true });
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a'); link.download = `animation_sequence_${extension}.zip`; link.href = URL.createObjectURL(content); link.click();
    } else if (format === 'gif') {
      try {
        const workerResponse = await fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js');
        const workerBlob = await workerResponse.blob(); const workerUrl = URL.createObjectURL(workerBlob);
        const gif = new GIF({ workers: 2, quality: 1, width: width, height: height, workerScript: workerUrl, transparent: 'rgba(0,0,0,0)' });
        frames.forEach((frame) => { const canvas = getFrameCanvas(frame); if (canvas) gif.addFrame(canvas, { delay: 1000 / fps, copy: true }); });
        gif.on('finished', (blob: Blob) => { const link = document.createElement('a'); link.download = 'animation.gif'; link.href = URL.createObjectURL(blob); link.click(); URL.revokeObjectURL(workerUrl); });
        gif.render();
      } catch (err) { alert('Error al generar el GIF.'); }
    }
  };

  const [bgImage, setBgImage] = useState<string | null>(null);
  const [isEditingBg, setIsEditingBg] = useState(false);
  const [bgTransform, setBgTransform] = useState<BgTransform>({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 0.5 });
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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  return (
    <div className={`app-container ${darkMode ? 'dark-mode' : ''}`}>
      <header>
        <div className="logo-container"><div className="logo">8-BIT ANIMATE</div><span className="signature">by maldo</span></div>
        <TopMenu onUndo={handleUndo} onRedo={handleRedo} canUndo={canUndo} canRedo={canRedo} onSave={handleSave} onOpen={handleOpen} onExport={handleExport} onNew={handleNew} onImport={() => setIsImporting(true)} showGrid={showGrid} setShowGrid={setShowGrid} zoom={zoom} setZoom={setZoom} darkMode={darkMode} setDarkMode={setDarkMode} audioEnabled={audioEnabled} setAudioEnabled={setAudioEnabled} />
      </header>
      <main>
        <Toolbar currentTool={currentTool} setTool={setCurrentTool} currentColor={currentColor} setColor={setCurrentColor} />
        <div className="editor-area">
          <PixelCanvas pixels={pixels} setPixels={updatePixels} width={width} height={height} color={currentColor} setColor={setCurrentColor} tool={currentTool} zoom={zoom} showGrid={showGrid} onUndo={handleUndo} onRedo={handleRedo} onHistoryPush={handleHistoryPush} currentFrameIndex={currentFrameIndex} frames={frames} onionSkin={onionSkin} bgImage={bgImage} bgTransform={bgTransform} setBgTransform={setBgTransform} isEditingBg={isEditingBg} isRecording={isRecording} playPixelSound={playSingleNote} />
        </div>
        {isImporting && <ImageImporter width={width} height={height} palette={FULL_PALETTE} onImport={handleImport} onCancel={() => setIsImporting(false)} />}
        <aside className="info-panel">
          <h3>Información</h3><p>Frames: {frames.length} / {MAX_FRAMES}</p><p>Frame actual: {currentFrameIndex + 1}</p><p>Lienzo: {width} x {height}</p>
          <div className="shift-controls"><h3>Mover Capa</h3><div className="shift-cross"><button className="up" onClick={() => shiftPixels(0, -1)}>⬆️</button><button className="left" onClick={() => shiftPixels(-1, 0)}>⬅️</button><button className="right" onClick={() => shiftPixels(1, 0)}>➡️</button><button className="down" onClick={() => shiftPixels(0, 1)}>⬇️</button></div></div>
          <div className="bg-panel"><h3>Imagen Referencia</h3>{!bgImage ? ( <input type="file" accept="image/*" onChange={handleBgUpload} /> ) : ( <div className="bg-controls"><button className={isEditingBg ? 'active' : ''} onClick={() => setIsEditingBg(!isEditingBg)}>{isEditingBg ? '✅ Guardar' : '🎯 Ajustar'}</button><label>Opacidad: <input type="range" min="0" max="1" step="0.1" value={bgTransform.opacity} onChange={e => setBgTransform({...bgTransform, opacity: parseFloat(e.target.value)})} /></label><label>Zoom: <input type="range" min="0.1" max="5" step="0.1" value={bgTransform.scale} onChange={e => setBgTransform({...bgTransform, scale: parseFloat(e.target.value)})} /></label><label>Girar: <input type="range" min="0" max="360" step="1" value={bgTransform.rotation} onChange={e => setBgTransform({...bgTransform, rotation: parseInt(e.target.value)})} /></label><button onClick={() => setBgImage(null)} className="danger">Quitar</button></div> )}</div>
          <div className="shortcuts"><p><strong>B</strong>: Pincel | <strong>E</strong>: Goma</p><p><strong>F</strong>: Relleno | <strong>Alt+Click</strong>: Gotero</p></div>
        </aside>
      </main>
      <Timeline frames={frames} currentFrameIndex={currentFrameIndex} setCurrentFrameIndex={setCurrentFrameIndex} addFrame={addFrame} removeFrame={removeFrame} duplicateFrame={duplicateFrame} isPlaying={isPlaying} setIsPlaying={setIsPlaying} fps={fps} setFps={setFps} width={width} height={height} onionSkin={onionSkin} setOnionSkin={setOnionSkin} isRecording={isRecording} setIsRecording={setIsRecording} />
    </div>
  );
}

export default App;
