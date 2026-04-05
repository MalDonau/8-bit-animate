import React from 'react';

interface TimelineProps {
  frames: string[][];
  currentFrameIndex: number;
  setCurrentFrameIndex: (index: number) => void;
  addFrame: () => void;
  removeFrame: () => void;
  duplicateFrame: () => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  fps: number;
  setFps: (fps: number) => void;
  width: number;
  height: number;
  onionSkin: number;
  setOnionSkin: (count: number) => void;
  moveFrame: (from: number, to: number) => void;
  playFrameSound: (framePixels: string[]) => void;
  lastAddedIndex: number | null;
}

const Timeline: React.FC<TimelineProps> = ({
  frames,
  currentFrameIndex,
  setCurrentFrameIndex,
  addFrame,
  removeFrame,
  duplicateFrame,
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
  lastAddedIndex
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

  return (
    <div className="timeline-container">
      <div className="playback-controls">
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
        </div>
        <div className="fps-control">
          <span>{fps} FPS</span>
          <input 
            type="range" 
            min="1" 
            max="30" 
            value={fps} 
            onChange={(e) => setFps(parseInt(e.target.value))} 
          />
        </div>
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
            <MiniCanvas pixels={frame} width={width} height={height} />
            {index === currentFrameIndex && <div className="scrub-cursor" />}
          </div>
        ))}
        {frames.length < 48 && (
          <button className="add-frame-btn" onClick={addFrame}>+</button>
        )}
      </div>

      <div className="frame-actions">
        <button onClick={duplicateFrame} title="Duplicar Frame">👯</button>
        <button onClick={removeFrame} title="Eliminar Frame" disabled={frames.length <= 1}>🗑️</button>
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
