import React, { useRef, useEffect, useState, useCallback } from 'react';

interface BgTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

interface PixelCanvasProps {
  pixels: string[];
  setPixels: (pixels: string[]) => void;
  width: number;
  height: number;
  color: string;
  setColor: (color: string) => void;
  tool: 'brush' | 'eraser' | 'fill' | 'eyedropper';
  zoom: number;
  showGrid: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onHistoryPush: (pixels: string[]) => void;
  currentFrameIndex?: number;
  frames?: string[][];
  onionSkin?: number;
  bgImage?: string | null;
  bgTransform?: BgTransform;
  setBgTransform?: (transform: BgTransform) => void;
  isEditingBg?: boolean;
  isPlaying?: boolean;
  playPixelSound?: (row: number, color: string, xPos: number, volumeFactor: number, colorDensity: number) => void;
  isRecording?: boolean;
  canvasBgColor?: string;
}

const EPHEMERAL_DURATION = 1000;
const EPHEMERAL_FADE_START = 700;

const PixelCanvas: React.FC<PixelCanvasProps> = ({
  pixels, setPixels, width, height, color, setColor, tool, zoom, showGrid,
  onHistoryPush, currentFrameIndex = 0, frames = [], onionSkin = 0,
  bgImage, bgTransform, setBgTransform, isEditingBg, isPlaying,
  playPixelSound, isRecording = false, canvasBgColor = '#ffffff'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeButton, setActiveButton] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPixelIndex, setLastPixelIndex] = useState(-1);

  const ephemeralRef = useRef<Array<{ index: number; color: string; timestamp: number }>>([]);
  const rafRef = useRef<number | null>(null);
  const drawCanvasRef = useRef<() => void>(() => {});

  const [magnifier, setMagnifier] = useState<{ screenX: number; screenY: number; canvasX: number; canvasY: number } | null>(null);
  const magnifierTimerRef = useRef<number | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);

  const computeMagPos = useCallback((screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      screenX,
      screenY,
      canvasX: ((screenX - rect.left) / rect.width) * width,
      canvasY: ((screenY - rect.top) / rect.height) * height,
    };
  }, [width, height]);

  const cancelMagnifierTimer = () => {
    if (magnifierTimerRef.current !== null) {
      window.clearTimeout(magnifierTimerRef.current);
      magnifierTimerRef.current = null;
    }
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (onionSkin > 0 && frames.length > 0) {
      for (let i = 1; i <= onionSkin; i++) {
        const prevIndex = currentFrameIndex - i;
        if (prevIndex >= 0) {
          const prevFrame = frames[prevIndex];
          ctx.globalAlpha = 0.3 / i;
          ctx.fillStyle = 'rgba(255, 0, 0, 1)';
          prevFrame.forEach((pxColor, index) => {
            if (pxColor === 'transparent') return;
            ctx.fillRect(index % width, Math.floor(index / width), 1, 1);
          });
        }
        const nextIndex = currentFrameIndex + i;
        if (nextIndex < frames.length) {
          const nextFrame = frames[nextIndex];
          ctx.globalAlpha = 0.3 / i;
          ctx.fillStyle = 'rgba(0, 255, 0, 1)';
          nextFrame.forEach((pxColor, index) => {
            if (pxColor === 'transparent') return;
            ctx.fillRect(index % width, Math.floor(index / width), 1, 1);
          });
        }
      }
    }

    ctx.globalAlpha = 1.0;
    pixels.forEach((pxColor, index) => {
      if (pxColor === 'transparent') return;
      const x = index % width;
      const y = Math.floor(index / width);
      ctx.fillStyle = pxColor;
      ctx.fillRect(x, y, 1, 1);
    });

    if (ephemeralRef.current.length > 0) {
      const now = performance.now();
      ephemeralRef.current.forEach((p) => {
        const age = now - p.timestamp;
        if (age >= EPHEMERAL_DURATION) return;
        const alpha = age <= EPHEMERAL_FADE_START
          ? 1
          : 1 - (age - EPHEMERAL_FADE_START) / (EPHEMERAL_DURATION - EPHEMERAL_FADE_START);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.index % width, Math.floor(p.index / width), 1, 1);
      });
      ctx.globalAlpha = 1.0;
    }
  }, [pixels, width, onionSkin, frames, currentFrameIndex]);

  useEffect(() => { drawCanvasRef.current = drawCanvas; }, [drawCanvas]);
  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  const tick = useCallback(() => {
    const now = performance.now();
    ephemeralRef.current = ephemeralRef.current.filter((p) => now - p.timestamp < EPHEMERAL_DURATION);
    drawCanvasRef.current();
    if (ephemeralRef.current.length > 0) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      rafRef.current = null;
    }
  }, []);

  const startTick = useCallback(() => {
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  useEffect(() => {
    ephemeralRef.current = [];
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [currentFrameIndex, width, height]);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  const getPixelIndex = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return -1;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * width);
    const y = Math.floor(((clientY - rect.top) / rect.height) * height);
    if (x >= 0 && x < width && y >= 0 && y < height) return y * width + x;
    return -1;
  }, [width, height]);

  const handleAction = useCallback((index: number, toolOverride?: string) => {
    if (index === -1) return;
    setLastPixelIndex(index);
    const currentTool = toolOverride || tool;
    if (currentTool === 'eyedropper') {
      const pickedColor = pixels[index];
      if (pickedColor !== 'transparent') setColor(pickedColor);
      return;
    }

    if (!isRecording) {
      if (currentTool === 'brush') {
        ephemeralRef.current.push({ index, color, timestamp: performance.now() });
        if (playPixelSound) {
          const density = ephemeralRef.current.filter(p => p.color === color).length;
          playPixelSound(Math.floor(index / width), color, index % width, 1.2, density);
        }
        startTick();
      }
      return;
    }

    const newPixels = [...pixels];
    if (currentTool === 'brush') {
      if (newPixels[index] === color) return;
      newPixels[index] = color;

      if (playPixelSound) {
        // Count current density of this color
        const density = newPixels.filter(c => c === color).length;
        playPixelSound(Math.floor(index / width), color, index % width, 1.2, density);
      }
    } else if (currentTool === 'eraser') {
      if (newPixels[index] === 'transparent') return;
      newPixels[index] = 'transparent';
    } else if (currentTool === 'fill') {
      const targetColor = pixels[index];
      if (targetColor === color) return;
      const stack = [index];
      const visited = new Set();
      while(stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);
        if (pixels[current] === targetColor) {
          newPixels[current] = color;
          const x = current % width;
          const y = Math.floor(current / width);
          if (x > 0) stack.push(current - 1);
          if (x < width - 1) stack.push(current + 1);
          if (y > 0) stack.push(current - width);
          if (y < height - 1) stack.push(current + width);
        }
      }
    }
    setPixels(newPixels);
  }, [pixels, tool, color, width, height, setColor, setPixels, playPixelSound, isRecording, startTick]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.setPointerCapture(e.pointerId);
    }

    if (isEditingBg && bgTransform && setBgTransform) {
      setIsDrawing(true);
      setDragStart({ x: e.clientX - bgTransform.x, y: e.clientY - bgTransform.y });
      return;
    }
    const index = getPixelIndex(e.clientX, e.clientY);
    if (index !== -1) {
      setIsDrawing(true);
      setActiveButton(e.button);
      const toolToUse = (e.altKey && e.button === 0) ? 'eyedropper' : (e.button === 2 ? 'eraser' : tool);
      handleAction(index, toolToUse);

      pressStartRef.current = { x: e.clientX, y: e.clientY };
      cancelMagnifierTimer();
      magnifierTimerRef.current = window.setTimeout(() => {
        const pos = computeMagPos(e.clientX, e.clientY);
        if (pos) setMagnifier(pos);
      }, 1000);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isEditingBg && isDrawing && bgTransform && setBgTransform) {
      setBgTransform({ ...bgTransform, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      return;
    }
    
    // Check if any button is pressed (1 for left, 2 for right, 4 for middle)
    // PointerEvent.buttons is a bitmask
    if (!isDrawing || e.buttons === 0) return;

    const index = getPixelIndex(e.clientX, e.clientY);
    if (activeButton !== null) {
      const toolToUse = (e.altKey && activeButton === 0) ? 'eyedropper' : (activeButton === 2 ? 'eraser' : tool);
      if (toolToUse === 'brush' || toolToUse === 'eraser') handleAction(index, toolToUse);
    }

    if (magnifierTimerRef.current !== null && pressStartRef.current) {
      const dx = e.clientX - pressStartRef.current.x;
      const dy = e.clientY - pressStartRef.current.y;
      if (dx * dx + dy * dy > 144) cancelMagnifierTimer();
    }
    if (magnifier) {
      const next = computeMagPos(e.clientX, e.clientY);
      if (next) setMagnifier(next);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (canvas && e.pointerId !== undefined) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (err) {
        // Ignore if pointerId is invalid
      }
    }
    setIsDrawing(false);
    setActiveButton(null);
    cancelMagnifierTimer();
    setMagnifier(null);
    pressStartRef.current = null;
    if (!isEditingBg && isRecording) onHistoryPush(pixels);
  };

  useEffect(() => {
    if (isDrawing && isPlaying && lastPixelIndex !== -1 && activeButton !== null) {
      const effectiveTool = (activeButton === 2) ? 'eraser' : tool;
      if (effectiveTool === 'brush' || effectiveTool === 'eraser') {
        handleAction(lastPixelIndex, effectiveTool);
      }
    }
  }, [currentFrameIndex, isPlaying, isDrawing, lastPixelIndex, activeButton, tool, handleAction]);

  useEffect(() => {
    if (!magnifier) return;
    const src = canvasRef.current;
    const mag = magnifierCanvasRef.current;
    if (!src || !mag) return;
    const ctx = mag.getContext('2d');
    if (!ctx) return;
    const SIZE = mag.width;
    const SRC_PX = 7;
    const halfSrc = SRC_PX / 2;
    let sx = magnifier.canvasX - halfSrc;
    let sy = magnifier.canvasY - halfSrc;
    if (sx < 0) sx = 0;
    if (sy < 0) sy = 0;
    if (sx + SRC_PX > width) sx = width - SRC_PX;
    if (sy + SRC_PX > height) sy = height - SRC_PX;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = canvasBgColor;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(src, sx, sy, SRC_PX, SRC_PX, 0, 0, SIZE, SIZE);
    const pxSize = SIZE / SRC_PX;
    if (showGrid) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= SRC_PX; i++) {
        const v = Math.round(i * pxSize) + 0.5;
        ctx.moveTo(v, 0);
        ctx.lineTo(v, SIZE);
        ctx.moveTo(0, v);
        ctx.lineTo(SIZE, v);
      }
      ctx.stroke();
    }
    const offX = Math.floor(magnifier.canvasX - sx);
    const offY = Math.floor(magnifier.canvasY - sy);
    ctx.strokeStyle = 'rgba(255, 50, 50, 0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(offX * pxSize, offY * pxSize, pxSize, pxSize);
  }, [magnifier, pixels, canvasBgColor, width, height, showGrid]);

  const MAG_SIZE = 140;
  const MAG_OFFSET = 60;
  let magStyle: React.CSSProperties | null = null;
  if (magnifier) {
    const showAbove = magnifier.screenY > MAG_SIZE + MAG_OFFSET + 16;
    const top = showAbove
      ? magnifier.screenY - MAG_SIZE - MAG_OFFSET
      : magnifier.screenY + MAG_OFFSET;
    const left = Math.max(
      8,
      Math.min(window.innerWidth - MAG_SIZE - 8, magnifier.screenX - MAG_SIZE / 2)
    );
    magStyle = { position: 'fixed', top, left, width: MAG_SIZE, height: MAG_SIZE, zIndex: 1000 };
  }

  return (
    <div
      className="canvas-container"
      style={{
        width: width * zoom, height: height * zoom, flexShrink: 0, position: 'relative',
        cursor: isEditingBg ? (isDrawing ? 'grabbing' : 'grab') : (tool === 'eyedropper' ? 'crosshair' : 'default'),
        background: canvasBgColor, overflow: 'hidden', touchAction: 'none'
      }}
    >
      {bgImage && bgTransform && (
        <img 
          src={bgImage} 
          style={{
            position: 'absolute',
            left: 0, top: 0,
            transform: `translate(${bgTransform.x}px, ${bgTransform.y}px) rotate(${bgTransform.rotation}deg) scale(${bgTransform.scale})`,
            opacity: bgTransform.opacity,
            pointerEvents: 'none',
            imageRendering: 'pixelated',
            transformOrigin: 'center'
          }}
          alt="bg"
        />
      )}
      <canvas
        ref={canvasRef} width={width} height={height}
        style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block', position: 'relative', zIndex: 1 }}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      {showGrid && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 2, backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)`, backgroundSize: `${100 / width}% ${100 / height}%` }} />
      )}
      {magnifier && magStyle && (
        <div className="canvas-magnifier" style={magStyle}>
          <canvas
            ref={magnifierCanvasRef}
            width={MAG_SIZE}
            height={MAG_SIZE}
            style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }}
          />
        </div>
      )}
    </div>
  );
};

export default PixelCanvas;
