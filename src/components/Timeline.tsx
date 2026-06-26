import React from 'react';
import type { Frame, LayerKey } from '../App';

interface TimelineProps {
  frames: Frame[];
  activeLayer: LayerKey;
  currentFrameIndex: number;
  setCurrentFrameIndex: (index: number) => void;
  addFrame: () => void;
  removeFrame: () => void;
  duplicateFrame: () => void;
  clearFrame: () => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  fps: number;
  setFps: (fps: number) => void;
  width: number;
  height: number;
  onionSkin: number;
  setOnionSkin: (count: number) => void;
  moveFrame: (from: number, to: number) => void;
  playFrameSound: (frame: Frame) => void;
  lastAddedIndex: number | null;
  isRecording: boolean;
  setIsRecording: (rec: boolean) => void;
  hideMainPlayback?: boolean;
  fpsControl?: React.ReactNode;
}

const Timeline: React.FC<TimelineProps> = ({
  frames,
  activeLayer,
  currentFrameIndex,
  setCurrentFrameIndex,
  addFrame,
  removeFrame,
  duplicateFrame,
  clearFrame,
  isPlaying,
  setIsPlaying,
  fps,
  setFps,
  width,
  height,
  onionSkin,
  setOnionSkin,
  moveFrame,
  playFrameSound,
  lastAddedIndex,
  isRecording,
  setIsRecording,
  hideMainPlayback = false,
  fpsControl
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const isScrubbing = React.useRef(false);

  const toggleOnionSkin = () => {
    const sequence = [0, 1, 2, 3, 4];
    const currentIndex = sequence.indexOf(onionSkin);
    const nextIndex = (currentIndex + 1) % sequence.length;
    setOnionSkin(sequence[nextIndex]);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('fromIndex', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    const fromIndex = parseInt(e.dataTransfer.getData('fromIndex'));
    if (fromIndex !== toIndex) {
      moveFrame(fromIndex, toIndex);
    }
  };

  const handleScrub = (clientX: number) => {
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const scrollLeft = scrollRef.current.scrollLeft;
    const x = clientX - rect.left + scrollLeft;
    
    // Each thumbnail is 50px width + 8px gap
    const itemWidth = 58; 
    const index = Math.max(0, Math.min(frames.length - 1, Math.floor(x / itemWidth)));
    
    if (index !== currentFrameIndex) {
      setCurrentFrameIndex(index);
      playFrameSound(frames[index]);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).classList.contains('frames-list')) {
      isScrubbing.current = true;
      handleScrub(e.clientX);
      scrollRef.current?.setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (isScrubbing.current) {
      handleScrub(e.clientX);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    isScrubbing.current = false;
    try {
      scrollRef.current?.releasePointerCapture(e.pointerId);
    } catch(err) {}
  };

  // Auto-scroll to end when frames are added
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        left: scrollRef.current.scrollWidth,
        behavior: 'smooth'
      });
    }
  }, [frames.length]);

  // Keep the currently selected thumbnail visible (centered) when the
  // selection changes — useful when scrubbing from outside the strip,
  // e.g. via the mobile bottom dots.
  React.useEffect(() => {
    const selected = scrollRef.current?.querySelector('.frame-thumbnail.selected') as HTMLElement | null;
    selected?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [currentFrameIndex]);

  return (
    <div className="timeline-container">
      <div className="playback-controls">
        {!hideMainPlayback && (
          <div className="main-playback">
            <button
              onClick={toggleOnionSkin}
              className={`onion-button ${onionSkin > 0 ? 'active' : ''}`}
              title="Papel Cebolla"
            >
              ◎{onionSkin > 0 ? onionSkin : ''}
            </button>
            <button
              className={`play-button ${isPlaying ? 'active' : ''}`}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? 'Ⅱ' : '▶'}
            </button>
            <button
              className={`rec-button ${isRecording ? 'active' : ''}`}
              onClick={() => setIsRecording(!isRecording)}
              title={isRecording ? 'REC: ON (los trazos se guardan)' : 'REC: OFF (los trazos se desvanecen)'}
            >
              ●
            </button>
          </div>
        )}
        {fpsControl !== undefined ? fpsControl : (
          <div className="fps-control">
            <span className="fps-row" title="Velocidad (FPS)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="3" x2="15" y2="3" /><line x1="12" y1="3" x2="12" y2="7" /><circle cx="12" cy="14" r="7" /><line x1="12" y1="14" x2="12" y2="10" /></svg>
              {fps} FPS
            </span>
            <input
              type="range"
              min="1"
              max="30"
              value={fps}
              onChange={(e) => setFps(parseInt(e.target.value))}
            />
          </div>
        )}
      </div>

      <div 
        className="frames-list" 
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {frames.map((frame, index) => (
          <div 
            key={index}
            className={`frame-thumbnail ${index === currentFrameIndex ? 'selected' : ''} ${index === lastAddedIndex ? 'new-frame' : ''}`}
            onClick={() => {
              setCurrentFrameIndex(index);
              playFrameSound(frame);
            }}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
          >
            <div className="frame-number">{index + 1}</div>
            <MiniCanvas pixels={frame[activeLayer]} width={width} height={height} />
            {index === currentFrameIndex && <div className="scrub-cursor" />}
          </div>
        ))}
        {frames.length < 48 && (
          <button className="add-frame-btn" onClick={addFrame}>+</button>
        )}
      </div>

      <div className="frame-actions">
        <button onClick={duplicateFrame} title="Duplicar Frame">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
        <button onClick={clearFrame} title="Borrar contenido del Frame">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="8" y1="8" x2="16" y2="16"></line><line x1="16" y1="8" x2="8" y2="16"></line></svg>
        </button>
        <button onClick={removeFrame} title="Eliminar Frame" disabled={frames.length <= 1}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      </div>
    </div>
  );
};

const MiniCanvas: React.FC<{ pixels: string[], width: number, height: number }> = ({ pixels, width, height }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    pixels.forEach((color, index) => {
      if (color === 'transparent') return;
      ctx.fillStyle = color;
      ctx.fillRect(index % width, Math.floor(index / width), 1, 1);
    });
  }, [pixels, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="mini-canvas" />;
};

export default Timeline;
