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
  playPixelSound?: (row: number, color: string, xPos: number, volumeFactor: number) => void;
}

const PixelCanvas: React.FC<PixelCanvasProps> = ({
  pixels, setPixels, width, height, color, setColor, tool, zoom, showGrid,
  onHistoryPush, currentFrameIndex = 0, frames = [], onionSkin = 0,
  bgImage, bgTransform, setBgTransform, isEditingBg, isPlaying,
  playPixelSound
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeButton, setActiveButton] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPixelIndex, setLastPixelIndex] = useState(-1);

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
  }, [pixels, width, onionSkin, frames, currentFrameIndex]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

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
    const newPixels = [...pixels];
    if (currentTool === 'brush') {
      if (newPixels[index] === color) return;
      newPixels[index] = color;
      if (playPixelSound) playPixelSound(Math.floor(index / width), color, index % width, 1.2);
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
  }, [pixels, tool, color, width, height, setColor, setPixels, playPixelSound]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditingBg && bgTransform && setBgTransform) {
      setIsDrawing(true);
      setDragStart({ x: e.clientX - bgTransform.x, y: e.clientY - bgTransform.y });
      return;
    }
    const index = getPixelIndex(e.clientX, e.clientY);
    if (index !== -1) {
      setIsDrawing(true);
      setActiveButton(e.button);
      setLastPixelIndex(index);
      const toolToUse = (e.altKey && e.button === 0) ? 'eyedropper' : (e.button === 2 ? 'eraser' : tool);
      handleAction(index, toolToUse);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isEditingBg && isDrawing && bgTransform && setBgTransform) {
      setBgTransform({ ...bgTransform, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      return;
    }
    const index = getPixelIndex(e.clientX, e.clientY);
    if (index !== -1) setLastPixelIndex(index);
    if (isDrawing && activeButton !== null) {
      const toolToUse = (e.altKey && activeButton === 0) ? 'eyedropper' : (activeButton === 2 ? 'eraser' : tool);
      if (toolToUse === 'brush' || toolToUse === 'eraser') handleAction(index, toolToUse);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setActiveButton(null);
    setLastPixelIndex(-1);
    if (!isEditingBg) onHistoryPush(pixels);
  };

  // Recording logic: Now depends on isPlaying instead of isRecording
  useEffect(() => {
    if (isDrawing && isPlaying && lastPixelIndex !== -1 && activeButton !== null) {
      const effectiveTool = (activeButton === 2) ? 'eraser' : tool;
      if (effectiveTool === 'brush' || effectiveTool === 'eraser') {
        handleAction(lastPixelIndex, effectiveTool);
      }
    }
  }, [currentFrameIndex, isPlaying, isDrawing, lastPixelIndex, activeButton, tool, handleAction]);

  return (
    <div 
      className="canvas-container"
      style={{
        width: width * zoom, height: height * zoom, flexShrink: 0, position: 'relative',
        cursor: isEditingBg ? (isDrawing ? 'grabbing' : 'grab') : (tool === 'eyedropper' ? 'crosshair' : 'default'),
        background: '#fff', overflow: 'hidden'
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
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      {showGrid && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 2, backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)`, backgroundSize: `${100 / width}% ${100 / height}%` }} />
      )}
    </div>
  );
};

export default PixelCanvas;
